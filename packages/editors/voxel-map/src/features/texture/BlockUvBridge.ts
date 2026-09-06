// Import Third-party Dependencies
import {
  tileRefForSlot,
  type VoxelRenderer,
  type ResolvedBlockDefinition,
  type ResolvedTileRef
} from "@jolly-pixel/voxel.renderer";
import {
  UVRegion,
  UV_FACES,
  type UVMap,
  type UVMapListener,
  type UVFace,
  type UVGeometry,
  type UVRegionData,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  blockShapeUv,
  type BlockShapeUv,
  type UVFaceBounds
} from "./blockShapeUv.ts";
import { editorState } from "../../EditorState.ts";

// CONSTANTS
const kRegionIdPrefix = "block-";
const kRegionColor = "#4488ff";
const kWholeTile: UVFaceBounds = {
  u0: 0,
  v0: 0,
  u1: 1,
  v1: 1
};
const kBoxShapeUv: BlockShapeUv = {
  activeFaces: [...UV_FACES],
  bounds: Object.fromEntries(
    UV_FACES.map((face) => [face, kWholeTile])
  ) as Record<UVFace, UVFaceBounds>,
  triangles: {},
  parts: {},
  faceRanges: {},
  isBox: true
};

function rectsEqual(
  a: SelectionRect,
  b: SelectionRect
): boolean {
  return a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height;
}

function regionsEqual(
  a: UVRegion,
  b: UVRegion
): boolean {
  if (a.state !== b.state) {
    return false;
  }

  const faces = new Set([
    ...a.faces,
    ...b.faces
  ]);

  return [...faces].every(
    (face) => rectsEqual(a.rectFor(face), b.rectFor(face))
  );
}

function geometryFor(
  rect: SelectionRect,
  shapeUv: BlockShapeUv,
  face: UVFace
): UVGeometry {
  const parts = shapeUv.parts[face];
  if (parts) {
    return {
      shape: "compound",
      rect,
      parts
    };
  }

  const corner = shapeUv.triangles[face];

  return corner ?
    {
      shape: "triangle",
      corner,
      rect
    } :
    rect;
}

function regionId(
  blockId: number
): string {
  return `${kRegionIdPrefix}${blockId}`;
}

function blockIdFromRegion(
  id: string
): number | null {
  if (!id.startsWith(kRegionIdPrefix)) {
    return null;
  }
  const value = Number(id.slice(kRegionIdPrefix.length));

  return Number.isNaN(value) ? null : value;
}

export interface BlockUvBridgeOptions {
  runLocalRestore?: <T>(fn: () => T) => T;
}

export class BlockUvBridge {
  readonly #uv: UVMap;
  readonly #vr: VoxelRenderer;
  readonly #runLocalRestore: <T>(fn: () => T) => T;
  #tilesetId: string | null = null;
  #tileSize = 1;
  #rebuilding = false;
  #applying = false;
  #stateSubscriptions: Array<() => void> = [];

  constructor(
    uv: UVMap,
    vr: VoxelRenderer,
    options: BlockUvBridgeOptions = {}
  ) {
    this.#uv = uv;
    this.#vr = vr;
    this.#runLocalRestore = options.runLocalRestore ?? ((fn) => fn());

    this.#uv.on("region-moved", this.#onRegionMoved);
    this.#uv.on("region-dragging", this.#onRegionDragging);
    this.#uv.on("region-state-changed", this.#onRegionStateChanged);
    this.#uv.on("region-deleted", this.#onRegionDeleted);
    this.#uv.on("selection-changed", this.#onSelectionChanged);
    this.#stateSubscriptions.push(
      editorState.on("blockRegistryChanged", this.#onBlockRegistryChanged),
      editorState.on("selectedBlockChange", this.#onSelectedBlockChange)
    );
  }

  setActiveTileset(
    tilesetId: string,
    tileSize: number
  ): void {
    if (this.#tilesetId === tilesetId && this.#tileSize === tileSize) {
      return;
    }
    this.#tilesetId = tilesetId;
    this.#tileSize = tileSize;
    this.#rebuild();
  }

  dispose(): void {
    this.#uv.off("region-moved", this.#onRegionMoved);
    this.#uv.off("region-dragging", this.#onRegionDragging);
    this.#uv.off("region-state-changed", this.#onRegionStateChanged);
    this.#uv.off("region-deleted", this.#onRegionDeleted);
    this.#uv.off("selection-changed", this.#onSelectionChanged);
    for (const unsubscribe of this.#stateSubscriptions.splice(0)) {
      unsubscribe();
    }
  }

  #blocksOnActiveTileset(): ResolvedBlockDefinition[] {
    if (!this.#tilesetId) {
      return [];
    }

    return [...this.#vr.engine.blockRegistry.getAll()].filter(
      (block) => block.defaultTexture?.tilesetId === this.#tilesetId
    );
  }

  #rebuild(): void {
    this.#rebuilding = true;
    try {
      this.#runLocalRestore(() => {
        for (const region of [...this.#uv.regions]) {
          if (blockIdFromRegion(region.id) !== null) {
            this.#uv.delete(region.id);
          }
        }
        for (const block of this.#blocksOnActiveTileset()) {
          this.#restoreRegionFor(block);
        }
      });
    }
    finally {
      this.#rebuilding = false;
    }

    this.#onSelectedBlockChange(editorState.selectedBlockId);
  }

  #shapeUvOf(
    block: ResolvedBlockDefinition
  ): BlockShapeUv {
    const shape = this.#vr.engine.shapeRegistry.get(block.shapeId);

    return shape ? blockShapeUv(shape) : kBoxShapeUv;
  }

  #regionFor(
    block: ResolvedBlockDefinition
  ): UVRegion {
    const id = regionId(block.id);
    const faceTextures = block.faceTextures ?? {};
    const shapeUv = this.#shapeUvOf(block);

    if (Object.keys(faceTextures).length === 0 && shapeUv.isBox) {
      return new UVRegion({
        id,
        color: kRegionColor,
        state: "collapsed",
        rect: this.#rectOf(block.defaultTexture!)
      });
    }

    const faces = Object.fromEntries(
      shapeUv.activeFaces.map((face): [UVFace, UVGeometry] => {
        const rect = this.#rectOf(
          tileRefForSlot(block, face) ?? block.defaultTexture!,
          shapeUv.bounds[face]
        );

        return [
          face,
          geometryFor(rect, shapeUv, face)
        ];
      })
    ) as Record<UVFace, UVGeometry>;

    return new UVRegion({
      id,
      color: kRegionColor,
      state: "uncollapsed",
      faces,
      activeFaces: [...shapeUv.activeFaces]
    });
  }

  #rectOf(
    tileRef: ResolvedTileRef,
    bounds: UVFaceBounds = kWholeTile
  ): SelectionRect {
    const tileSize = this.#tileSize;

    return {
      x: (tileRef.col + bounds.u0) * tileSize,
      y: (tileRef.row + (1 - bounds.v1)) * tileSize,
      width: (bounds.u1 - bounds.u0) * tileSize,
      height: (bounds.v1 - bounds.v0) * tileSize
    };
  }

  #tileRefOf(
    rect: SelectionRect,
    template: ResolvedTileRef,
    bounds: UVFaceBounds = kWholeTile
  ): ResolvedTileRef {
    return {
      ...template,
      col: (rect.x / this.#tileSize) - bounds.u0,
      row: (rect.y / this.#tileSize) - (1 - bounds.v1)
    };
  }

  #restoreRegionFor(
    block: ResolvedBlockDefinition
  ): void {
    const region = this.#regionFor(block);
    const existing = this.#uv.get(region.id);
    if (existing && regionsEqual(existing, region)) {
      return;
    }

    this.#uv.restore(region);
  }

  #applyRegionToBlock(
    region: UVRegion
  ): void {
    const blockId = blockIdFromRegion(region.id);
    if (blockId === null) {
      return;
    }

    const block = this.#vr.engine.blockRegistry.get(blockId);
    if (!block?.defaultTexture) {
      return;
    }

    const shapeUv = this.#shapeUvOf(block);
    const collapsedSlot = region.collapsedFace ??
      shapeUv.activeFaces[0] ??
      "front";
    const updated: ResolvedBlockDefinition = region.state === "uncollapsed" ?
      {
        ...block,
        faceTextures: Object.fromEntries(
          shapeUv.activeFaces.map((face) => [
            face,
            this.#tileRefOf(
              region.rectFor(face),
              block.defaultTexture!,
              shapeUv.bounds[face]
            )
          ])
        )
      } :
      {
        ...block,
        faceTextures: {},
        defaultTexture: this.#tileRefOf(
          region.rectFor(collapsedSlot),
          block.defaultTexture,
          shapeUv.bounds[collapsedSlot]
        )
      };

    this.#applying = true;
    try {
      this.#vr.engine.defineBlock(updated);
    }
    finally {
      this.#applying = false;
    }
  }

  readonly #onBlockRegistryChanged = (): void => {
    if (this.#applying) {
      return;
    }
    this.#rebuild();
  };

  readonly #onRegionMoved: UVMapListener<"region-moved"> = (event) => {
    const block = this.#blockOf(event.region.id);
    if (!block) {
      return;
    }

    if (regionsEqual(this.#regionFor(block), event.region)) {
      return;
    }

    this.#applyRegionToBlock(event.region);
  };

  readonly #onRegionDragging: UVMapListener<"region-dragging"> = (event) => {
    if (this.#rebuilding) {
      return;
    }

    const block = this.#blockOf(event.id);
    if (!block) {
      return;
    }

    const region = this.#uv.get(event.id);
    if (!region) {
      return;
    }

    const dragged = region.withRect(event.rect, event.face ?? undefined);
    if (regionsEqual(this.#regionFor(block), dragged)) {
      return;
    }

    this.#applyRegionToBlock(dragged);
  };

  readonly #onRegionStateChanged: UVMapListener<"region-state-changed"> = (event) => {
    if (this.#rebuilding) {
      return;
    }
    const block = this.#blockOf(event.region.id);
    if (!block) {
      return;
    }

    if (this.#rederivedOnUncollapse(block, event)) {
      return;
    }

    this.#applyRegionToBlock(event.region);
  };

  #rederivedOnUncollapse(
    block: ResolvedBlockDefinition,
    event: { region: UVRegion; previous: UVRegionData; }
  ): boolean {
    const wasCollapsed = (event.previous.state ?? "collapsed") === "collapsed";
    if (event.region.state !== "uncollapsed" || !wasCollapsed) {
      return false;
    }

    const derived = this.#regionFor(block);
    if (this.#shapeUvOf(block).isBox || derived.state !== "uncollapsed") {
      return false;
    }

    this.#rebuilding = true;
    try {
      this.#runLocalRestore(() => this.#uv.restore(derived));
    }
    finally {
      this.#rebuilding = false;
    }
    this.#applyRegionToBlock(derived);

    return true;
  }

  #blockOf(
    id: string
  ): ResolvedBlockDefinition | undefined {
    const blockId = blockIdFromRegion(id);
    if (blockId === null) {
      return undefined;
    }

    const block = this.#vr.engine.blockRegistry.get(blockId);

    return block?.defaultTexture ? block : undefined;
  }

  readonly #onRegionDeleted: UVMapListener<"region-deleted"> = (event) => {
    if (this.#rebuilding) {
      return;
    }

    const blockId = blockIdFromRegion(event.region.id);
    if (blockId === null) {
      return;
    }

    const block = this.#vr.engine.blockRegistry.get(blockId);
    if (!block) {
      return;
    }

    this.#restoreRegionFor(block);
    this.#onSelectedBlockChange(editorState.selectedBlockId);
  };

  readonly #onSelectionChanged: UVMapListener<"selection-changed"> = (event) => {
    if (event.selectedRegionId === null) {
      return;
    }

    const blockId = blockIdFromRegion(event.selectedRegionId);
    if (blockId === null) {
      return;
    }

    editorState.setSelectedBlock(blockId);
  };

  readonly #onSelectedBlockChange = (id: number): void => {
    const uvId = regionId(id);

    this.#uv.select(this.#uv.get(uvId) ? uvId : null);
  };
}
