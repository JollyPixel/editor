// Import Third-party Dependencies
import type {
  VoxelRenderer,
  BlockDefinition
} from "@jolly-pixel/voxel.renderer";
import type {
  UVMap,
  UVMapListener,
  SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyBlockUpdate } from "./applyBlockUpdate.ts";
import { editorState } from "../EditorState.ts";

// CONSTANTS
const kRegionIdPrefix = "block-";
const kRegionColor = "#4488ff";

function rectsEqual(
  a: SelectionRect,
  b: SelectionRect
): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function regionId(
  blockId: number
): string {
  return `${kRegionIdPrefix}${blockId}`;
}

/**
 * Parses a `block-<id>` UV region id back to its block id, or null for any
 * other (manually-created, free-form) UV region.
 */
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
 * Mirrors block registry `defaultTexture` assignments (col/row on a fixed
 * tileset grid) as freely-draggable UV regions (`block-<id>`, sized to one
 * tileSize cell but positioned anywhere — no grid snapping, matching
 * pixel-draw-renderer's default UV behavior) on the texture editor, and
 * keeps both directions in sync. Regions only exist for blocks whose
 * `defaultTexture.tilesetId` matches the currently active tileset — call
 * `setActiveTileset()` whenever that changes.
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

  #restoreRegionFor(
    block: BlockDefinition
  ): void {
    const tileRef = block.defaultTexture!;
    const tileSize = this.#tileSize;
    const id = regionId(block.id);
    const rect: SelectionRect = {
      x: tileRef.col * tileSize,
      y: tileRef.row * tileSize,
      width: tileSize,
      height: tileSize
    };

    const existing = this.#uv.get(id);
    if (existing && rectsEqual(existing.rect, rect)) {
      return;
    }

    this.#uv.restore({ id, rect, color: kRegionColor });
  }

  readonly #onBlockRegistryChanged = (): void => {
    if (this.#applying) {
      return;
    }
    this.#rebuild();
  };

  readonly #onRegionMoved: UVMapListener<"region-moved"> = (event) => {
    const blockId = blockIdFromRegion(event.region.id);
    if (blockId === null) {
      return;
    }

    const block = this.#vr.engine.blockRegistry.get(blockId);
    if (!block?.defaultTexture) {
      return;
    }

    const col = event.region.rect.x / this.#tileSize;
    const row = event.region.rect.y / this.#tileSize;
    if (block.defaultTexture.col === col && block.defaultTexture.row === row) {
      return;
    }

    this.#applying = true;
    try {
      applyBlockUpdate(this.#vr, {
        ...block,
        defaultTexture: { ...block.defaultTexture, col, row }
      });
    }
    finally {
      this.#applying = false;
    }
  };

  /**
   * Self-heals a block region deleted via the generic UV toolbar — the
   * block still exists, so its region shouldn't be allowed to disappear.
   * Suppressed during setActiveTileset()'s own rebuild pass.
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
