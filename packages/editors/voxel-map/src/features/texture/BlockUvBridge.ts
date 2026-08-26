// Import Third-party Dependencies
import {
  Face,
  type VoxelRenderer,
  type BlockDefinition,
  type TileRef
} from "@jolly-pixel/voxel.renderer";
import {
  UVRegion,
  UV_FACES,
  type UVMap,
  type UVMapListener,
  type UVFace,
  type UVGeometry,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyBlockUpdate } from "../blocks/applyBlockUpdate.ts";
import { editorState } from "../../EditorState.ts";

// CONSTANTS
const kRegionIdPrefix = "block-";
const kRegionColor = "#4488ff";

const kFaceToVoxel: Record<UVFace, Face> = {
  front: Face.PosZ,
  back: Face.NegZ,
  left: Face.NegX,
  right: Face.PosX,
  top: Face.PosY,
  bottom: Face.NegY
};

function rectsEqual(
  a: SelectionRect,
  b: SelectionRect
): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function regionsEqual(
  a: UVRegion,
  b: UVRegion
): boolean {
  if (a.state !== b.state) {
    return false;
  }

  return UV_FACES.every((face) => rectsEqual(a.rectFor(face), b.rectFor(face)));
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

export class BlockUvBridge {
  readonly #uv: UVMap;
  readonly #vr: VoxelRenderer;
  #tilesetId: string | null = null;
  #tileSize = 1;
  #rebuilding = false;
  #applying = false;
  #stateSubscriptions: Array<() => void> = [];

  constructor(
    uv: UVMap,
    vr: VoxelRenderer
  ) {
    this.#uv = uv;
    this.#vr = vr;

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

  #blocksOnActiveTileset(): BlockDefinition[] {
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
      for (const region of [...this.#uv.regions]) {
        if (blockIdFromRegion(region.id) !== null) {
          this.#uv.delete(region.id);
        }
      }
      for (const block of this.#blocksOnActiveTileset()) {
        this.#restoreRegionFor(block);
      }
    }
    finally {
      this.#rebuilding = false;
    }

    // Deleting a region drops the selection, and the block selected at boot
    // never emits an event of its own, so the highlight is applied from state.
    this.#onSelectedBlockChange(editorState.selectedBlockId);
  }

  #regionFor(
    block: BlockDefinition
  ): UVRegion {
    const id = regionId(block.id);
    const fallback = this.#rectOf(block.defaultTexture!);
    const faceTextures = block.faceTextures ?? {};

    if (Object.keys(faceTextures).length === 0 && block.shapeId !== "ramp") {
      return new UVRegion({
        id,
        color: kRegionColor,
        state: "collapsed",
        rect: fallback
      });
    }

    const rectFor = (face: UVFace): SelectionRect => {
      const tileRef = faceTextures[kFaceToVoxel[face]];

      return tileRef ? this.#rectOf(tileRef) : fallback;
    };
    const rects = {
      front: rectFor("front"),
      back: rectFor("back"),
      left: rectFor("left"),
      right: rectFor("right"),
      top: rectFor("top"),
      bottom: rectFor("bottom")
    } satisfies Record<UVFace, SelectionRect>;
    const faces: Record<UVFace, UVGeometry> = { ...rects };

    if (block.shapeId === "ramp") {
      faces.left = {
        shape: "triangle",
        corner: "bottom-right",
        rect: rects.left
      };
      faces.right = {
        shape: "triangle",
        corner: "bottom-right",
        rect: rects.right
      };
    }

    return new UVRegion({
      id,
      color: kRegionColor,
      state: "uncollapsed",
      faces,
      activeFaces: block.shapeId === "ramp" ?
        ["back", "left", "right", "top", "bottom"] :
        [...UV_FACES]
    });
  }

  #rectOf(
    tileRef: TileRef
  ): SelectionRect {
    const tileSize = this.#tileSize;

    return {
      x: tileRef.col * tileSize,
      y: tileRef.row * tileSize,
      width: tileSize,
      height: tileSize
    };
  }

  #tileRefOf(
    rect: SelectionRect,
    template: TileRef
  ): TileRef {
    return {
      ...template,
      col: rect.x / this.#tileSize,
      row: rect.y / this.#tileSize
    };
  }

  #restoreRegionFor(
    block: BlockDefinition
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

    const updated: BlockDefinition = region.state === "uncollapsed" ?
      {
        ...block,
        faceTextures: Object.fromEntries(
          UV_FACES.map((face) => [
            kFaceToVoxel[face],
            this.#tileRefOf(region.rectFor(face), block.defaultTexture!)
          ])
        )
      } :
      {
        ...block,
        faceTextures: {},
        defaultTexture: this.#tileRefOf(region.rectFor("front"), block.defaultTexture)
      };

    this.#applying = true;
    try {
      applyBlockUpdate(this.#vr, updated);
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

  /**
   * `region-moved` only lands on pointer release, which leaves the map showing
   * the old texture for the whole drag. This applies each pointer move, so the
   * blocks follow live.
   */
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
    if (!this.#blockOf(event.region.id)) {
      return;
    }

    this.#applyRegionToBlock(event.region);
  };

  #blockOf(
    id: string
  ): BlockDefinition | undefined {
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

    // Deleting the selected region drops the selection, and putting the region
    // back does not bring it along. Remote deletions arrive during startup, so
    // without this the block selected at boot never gets highlighted.
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
