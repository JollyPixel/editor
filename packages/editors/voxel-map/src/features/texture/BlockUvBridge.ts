// Import Third-party Dependencies
import {
  tileRefForSlot,
  resolvedBlockTextureSlots,
  type VoxelRenderer,
  type ResolvedBlockDefinition,
  type ResolvedTileRef
} from "@jolly-pixel/voxel.renderer";
import {
  UVRegion,
  UV_FACES,
  type UVMap,
  type UVMapListener,
  type UVSlot,
  type UVGeometry,
  type UVRegionData,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  blockShapeUv,
  uvGeometryForSlot,
  type BlockShapeUv,
  type UVSlotBounds
} from "./blockShapeUv.ts";
import { editorState } from "../../EditorState.ts";

// CONSTANTS
const kRegionIdPrefix = "block-";
const kRegionColor = "#4488ff";
const kWholeTile: UVSlotBounds = {
  u0: 0,
  v0: 0,
  u1: 1,
  v1: 1
};
const kBoxShapeUv: BlockShapeUv = {
  activeFaces: [...UV_FACES],
  bounds: Object.fromEntries(
    UV_FACES.map((face) => [face, kWholeTile])
  ) as Record<UVSlot, UVSlotBounds>,
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
  const left = a.toJSON();
  const right = b.toJSON();
  if (
    left.state !== right.state ||
    left.name !== right.name ||
    left.color !== right.color ||
    a.collapsedFace !== b.collapsedFace
  ) {
    return false;
  }
  if (left.state === "collapsed" && right.state === "collapsed") {
    return rectsEqual(left.rect, right.rect) &&
      geometriesEqual(left.faces, right.faces);
  }
  if (left.state === "uncollapsed" && right.state === "uncollapsed") {
    return arraysEqual(left.activeFaces ?? [], right.activeFaces ?? []) &&
      geometriesEqual(left.faces, right.faces);
  }

  return false;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function geometriesEqual(
  a: Record<string, UVGeometry> | undefined,
  b: Record<string, UVGeometry> | undefined
): boolean {
  const left = Object.entries(a ?? {});
  const right = Object.entries(b ?? {});

  return left.length === right.length && left.every(
    ([slot, geometry], index) => slot === right[index]?.[0] &&
      JSON.stringify(geometry) === JSON.stringify(right[index]?.[1])
  );
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

    return [...this.#vr.engine.blockRegistry.getAll()].filter((block) => {
      const shape = this.#vr.engine.shapeRegistry.get(block.shapeId);

      return shape ? resolvedBlockTextureSlots(block, shape).some(
        ({ tile }) => tile.tilesetId === this.#tilesetId
      ) : false;
    });
  }

  #rebuild(): void {
    const desired = new Map(
      this.#blocksOnActiveTileset().map((block) => {
        const region = this.#regionFor(block);

        return [region.id, region] as const;
      })
    );
    this.#rebuilding = true;
    try {
      this.#runLocalRestore(() => {
        for (const region of [...this.#uv.regions]) {
          if (
            blockIdFromRegion(region.id) !== null &&
            !desired.has(region.id)
          ) {
            this.#uv.delete(region.id);
          }
        }
        for (const region of desired.values()) {
          const existing = this.#uv.get(region.id);
          if (!existing || !regionsEqual(existing, region)) {
            this.#uv.restore(region);
          }
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
    const shapeUv = this.#shapeUvOf(block);
    const hasFaceTextures = Object.keys(block.faceTextures ?? {}).length > 0;

    if (hasFaceTextures || !block.defaultTexture) {
      return this.#uncollapsedRegionFor(block, shapeUv);
    }

    if (shapeUv.isBox) {
      return new UVRegion({
        id: regionId(block.id),
        color: kRegionColor,
        state: "collapsed",
        rect: this.#rectOf(block.defaultTexture)
      });
    }

    return this.#uncollapsedRegionFor(block, shapeUv).collapse();
  }

  #uncollapsedRegionFor(
    block: ResolvedBlockDefinition,
    shapeUv: BlockShapeUv = this.#shapeUvOf(block)
  ): UVRegion {
    const id = regionId(block.id);
    const shape = this.#vr.engine.shapeRegistry.get(block.shapeId);
    const textureSlots = shape ? resolvedBlockTextureSlots(block, shape) : [];

    const faces = Object.fromEntries(
      textureSlots.map(({ slot: face, tile }): [UVSlot, UVGeometry] => {
        const rect = this.#rectOf(
          tile,
          shapeUv.bounds[face]
        );

        return [
          face,
          uvGeometryForSlot(rect, shapeUv, face)
        ];
      })
    ) as Record<UVSlot, UVGeometry>;

    return new UVRegion({
      id,
      color: kRegionColor,
      state: "uncollapsed",
      faces,
      activeFaces: textureSlots.map(({ slot }) => slot)
    });
  }

  #rectOf(
    tileRef: ResolvedTileRef,
    bounds: UVSlotBounds = kWholeTile
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
    bounds: UVSlotBounds = kWholeTile
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
    if (!block) {
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
          region.faces.map((face) => {
            const template = tileRefForSlot(block, face);
            if (!template) {
              throw new RangeError(`No texture template for UV slot "${face}"`);
            }

            return [face, this.#tileRefOf(
              region.rectFor(face),
              template,
              shapeUv.bounds[face]
            )];
          })
        )
      } :
      {
        ...block,
        faceTextures: {},
        defaultTexture: this.#tileRefOf(
          region.rectFor(collapsedSlot),
          tileRefForSlot(block, collapsedSlot)!,
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

    const dragged = region.withRect(
      event.rect,
      event.face ?? undefined
    );
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

    const shapeUv = this.#shapeUvOf(block);
    if (shapeUv.isBox) {
      return false;
    }

    const derived = this.#uncollapsedRegionFor(block, shapeUv);

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

    if (!block) {
      return undefined;
    }
    const shape = this.#vr.engine.shapeRegistry.get(block.shapeId);

    return shape && resolvedBlockTextureSlots(block, shape).length > 0 ?
      block :
      undefined;
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
