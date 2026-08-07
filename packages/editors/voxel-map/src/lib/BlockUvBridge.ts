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
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyBlockUpdate } from "./applyBlockUpdate.ts";
import { editorState } from "../EditorState.ts";

// CONSTANTS
const kRegionIdPrefix = "block-";
const kRegionColor = "#4488ff";

// Maps pixel-draw face names to voxel-renderer axis-based Face slots.
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

// Parses a `block-<id>` region id to its block id, or null for non-block regions.
function blockIdFromRegion(
  id: string
): number | null {
  if (!id.startsWith(kRegionIdPrefix)) {
    return null;
  }
  const value = Number(id.slice(kRegionIdPrefix.length));

  return Number.isNaN(value) ? null : value;
}

/**
 * Syncs block texture assignments with UVMap regions (one `block-<id>` region per block).
 * Collapsed = defaultTexture; uncollapsed = per-face faceTextures.
 */
export class BlockUvBridge {
  readonly #uv: UVMap;
  readonly #vr: VoxelRenderer;
  #tilesetId: string | null = null;
  #tileSize = 1;
  #rebuilding = false;
  #applying = false;

  constructor(
    uv: UVMap,
    vr: VoxelRenderer
  ) {
    this.#uv = uv;
    this.#vr = vr;

    this.#uv.on("region-moved", this.#onRegionMoved);
    this.#uv.on("region-state-changed", this.#onRegionStateChanged);
    this.#uv.on("region-deleted", this.#onRegionDeleted);
    this.#uv.on("selection-changed", this.#onSelectionChanged);
    editorState.addEventListener("blockRegistryChanged", this.#onBlockRegistryChanged);
    editorState.addEventListener("selectedBlockChange", this.#onSelectedBlockChange);
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
    this.#uv.off("region-state-changed", this.#onRegionStateChanged);
    this.#uv.off("region-deleted", this.#onRegionDeleted);
    this.#uv.off("selection-changed", this.#onSelectionChanged);
    editorState.removeEventListener("blockRegistryChanged", this.#onBlockRegistryChanged);
    editorState.removeEventListener("selectedBlockChange", this.#onSelectedBlockChange);
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
  }

  /**
   * Builds a region from a block definition (collapsed or uncollapsed).
   */
  #regionFor(
    block: BlockDefinition
  ): UVRegion {
    const id = regionId(block.id);
    const fallback = this.#rectOf(block.defaultTexture!);
    const faceTextures = block.faceTextures ?? {};

    if (Object.keys(faceTextures).length === 0) {
      return new UVRegion({
        id,
        color: kRegionColor,
        state: "collapsed",
        rect: fallback
      });
    }

    const faces = {} as Record<UVFace, SelectionRect>;
    for (const face of UV_FACES) {
      const tileRef = faceTextures[kFaceToVoxel[face]];
      faces[face] = tileRef ? this.#rectOf(tileRef) : fallback;
    }

    return new UVRegion({
      id,
      color: kRegionColor,
      state: "uncollapsed",
      faces
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

  /**
   * Writes a region back to its block definition.
   */
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

    // Skip if the registry already matches (prevents rebuild loops).
    if (regionsEqual(this.#regionFor(block), event.region)) {
      return;
    }

    this.#applyRegionToBlock(event.region);
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

  /**
   * Restores a block region if deleted via the generic UV toolbar.
   */
  readonly #onRegionDeleted: UVMapListener<"region-deleted"> = (event) => {
    if (this.#rebuilding) {
      return;
    }

    const blockId = blockIdFromRegion(event.region.id);
    if (blockId === null) {
      return;
    }

    const block = this.#vr.engine.blockRegistry.get(blockId);
    if (block) {
      this.#restoreRegionFor(block);
    }
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

  readonly #onSelectedBlockChange = (
    event: Event
  ): void => {
    const id = (event as CustomEvent<number>).detail;
    const uvId = regionId(id);

    this.#uv.select(this.#uv.get(uvId) ? uvId : null);
  };
}
