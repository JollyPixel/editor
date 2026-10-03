// Import Third-party Dependencies
import type {
  ResolvedBlockDefinition,
  TilesetSlot,
  VoxelView
} from "@jolly-pixel/voxel.renderer";
import type {
  UVMap,
  UVMapListener,
  UVRegion,
  UVRegionData
} from "@jolly-pixel/pixel-draw.renderer";
import { BlockProjection } from "@jolly-pixel/asset.voxel-map/client";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../../document/index.ts";
import { BlockUv } from "../uv/BlockUv.ts";
import { BlockUvSelectionSync } from "./BlockUvSelectionSync.ts";
import { SlotRegionIds } from "./SlotRegionIds.ts";
import type { BrushStore } from "../../../state/index.ts";
import type { BlockWriter } from "../../tilesets/TilesetBinding.ts";

export interface BlockUvBridgeOptions {
  runLocalRestore?: <T>(fn: () => T) => T;
  brush: BrushStore;
  mapDocument: MapDocumentSignals;
  blocks?: Pick<BlockWriter, "defineBlock">;
}

export class BlockUvBridge {
  readonly #uv: UVMap;
  readonly #view: VoxelView;
  readonly #blocks: Pick<BlockWriter, "defineBlock">;
  readonly #selection: BlockUvSelectionSync;
  readonly #runLocalRestore: <T>(fn: () => T) => T;
  #regions: SlotRegionIds | null = null;
  #tileSize = 1;
  #rebuilding = false;
  #applying = false;
  #dragged: UVRegion | null = null;
  #dragFrame: number | null = null;
  #unsubscribeRegistry: () => void;

  constructor(
    uv: UVMap,
    view: VoxelView,
    options: BlockUvBridgeOptions
  ) {
    this.#uv = uv;
    this.#view = view;
    this.#blocks = options.blocks ?? view.document;
    this.#selection = new BlockUvSelectionSync(
      uv,
      options.brush,
      () => this.#regions
    );
    this.#runLocalRestore = options.runLocalRestore ?? ((fn) => fn());

    this.#uv.on("region-moved", this.#onRegionMoved);
    this.#uv.on("region-dragging", this.#onRegionDragging);
    this.#uv.on("region-drag-ended", this.#flushDrag);
    this.#uv.on("region-state-changed", this.#onRegionStateChanged);
    this.#uv.on("region-rotated", this.#onRegionRotated);
    this.#uv.on("region-deleted", this.#onRegionDeleted);
    this.#unsubscribeRegistry = options.mapDocument.subscribe(
      "blockRegistryChanged",
      this.#onBlockRegistryChanged
    );
  }

  setActiveTileset(
    slot: TilesetSlot,
    tileSize: number
  ): void {
    if (
      this.#regions?.slot.equals(slot) &&
      this.#tileSize === tileSize
    ) {
      return;
    }
    this.#regions = new SlotRegionIds(slot);
    this.#tileSize = tileSize;
    this.#rebuild();
  }

  dispose(): void {
    this.#cancelDrag();
    this.#uv.off("region-moved", this.#onRegionMoved);
    this.#uv.off("region-dragging", this.#onRegionDragging);
    this.#uv.off("region-drag-ended", this.#flushDrag);
    this.#uv.off("region-state-changed", this.#onRegionStateChanged);
    this.#uv.off("region-rotated", this.#onRegionRotated);
    this.#uv.off("region-deleted", this.#onRegionDeleted);
    this.#unsubscribeRegistry();
    this.#selection.dispose();
  }

  #blocksOnActiveTileset(): ResolvedBlockDefinition[] {
    const slot = this.#regions?.slot;
    if (slot === undefined) {
      return [];
    }

    return [...this.#view.document.blocks.getAll()].filter(
      (block) => slot.owns(block.id) &&
        this.#uvOf(block).layout.usesTileset(slot.id)
    );
  }

  #uvOf(
    block: ResolvedBlockDefinition
  ): BlockUv {
    return new BlockUv(
      block,
      this.#view.shapes.get(block.shapeId),
      this.#tileSize
    );
  }

  #regionFor(
    block: ResolvedBlockDefinition
  ): UVRegion {
    return this.#uvOf(block).region();
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
            BlockProjection.localBlockIdOf(region.id) !== null &&
            !desired.has(region.id)
          ) {
            this.#uv.delete(region.id);
          }
        }
        for (const region of desired.values()) {
          const existing = this.#uv.get(region.id);
          if (!existing || !BlockUv.sameRegion(existing, region)) {
            this.#uv.restore(region);
          }
        }
      });
    }
    finally {
      this.#rebuilding = false;
    }

    this.#selection.refresh();
  }

  #restoreRegionFor(
    block: ResolvedBlockDefinition
  ): void {
    const region = this.#regionFor(block);
    const existing = this.#uv.get(region.id);
    if (existing && BlockUv.sameRegion(existing, region)) {
      return;
    }

    this.#uv.restore(region);
  }

  #applyRegionToBlock(
    region: UVRegion
  ): void {
    if (this.#dragged?.id === region.id) {
      this.#cancelDrag();
    }

    const blockId = this.#blockIdOf(region.id);
    if (blockId === null) {
      return;
    }

    const block = this.#view.document.blocks.get(blockId);
    if (!block) {
      return;
    }

    const updated = this.#uvOf(block).apply(region);

    this.#applying = true;
    try {
      this.#blocks.defineBlock(updated);
    }
    finally {
      this.#applying = false;
    }
  }

  readonly #onBlockRegistryChanged = (): void => {
    if (!this.#applying) {
      this.#rebuild();
    }
  };

  readonly #onRegionMoved: UVMapListener<"region-moved"> = (event) => {
    if (this.#dragged?.id === event.region.id) {
      this.#cancelDrag();
    }

    const block = this.#blockOf(event.region.id);
    if (!block || BlockUv.sameRegion(this.#regionFor(block), event.region)) {
      return;
    }

    this.#applyRegionToBlock(event.region);
  };

  readonly #onRegionDragging: UVMapListener<"region-dragging"> = ({ region }) => {
    if (this.#rebuilding || !this.#blockOf(region.id)) {
      return;
    }

    if (this.#dragged !== null && this.#dragged.id !== region.id) {
      this.#flushDrag();
    }
    this.#dragged = region;
    this.#dragFrame ??= requestAnimationFrame(this.#flushDrag);
  };

  readonly #flushDrag = (): void => {
    const dragged = this.#dragged;
    this.#cancelDrag();
    if (dragged === null) {
      return;
    }

    const block = this.#blockOf(dragged.id);
    if (block && !BlockUv.sameRegion(this.#regionFor(block), dragged)) {
      this.#applyRegionToBlock(dragged);
    }
  };

  #cancelDrag(): void {
    if (this.#dragFrame !== null) {
      cancelAnimationFrame(this.#dragFrame);
      this.#dragFrame = null;
    }
    this.#dragged = null;
  }

  readonly #onRegionStateChanged: UVMapListener<
    "region-state-changed"
  > = (event) => {
    if (this.#rebuilding) {
      return;
    }
    const block = this.#blockOf(event.region.id);
    if (!block || this.#rederivedOnFree(block, event)) {
      return;
    }

    this.#applyRegionToBlock(event.region);
  };

  readonly #onRegionRotated: UVMapListener<"region-rotated"> = (event) => {
    if (this.#rebuilding) {
      return;
    }
    const block = this.#blockOf(event.region.id);
    if (!block || BlockUv.sameRegion(this.#regionFor(block), event.region)) {
      return;
    }

    this.#applyRegionToBlock(event.region);
  };

  #rederivedOnFree(
    block: ResolvedBlockDefinition,
    event: { region: UVRegion; previous: UVRegionData; }
  ): boolean {
    const wasStacked = event.previous.state === "stacked";
    if (event.region.state !== "free" || !wasStacked) {
      return false;
    }

    const uv = this.#uvOf(block);
    if (uv.shape === undefined || uv.isBox) {
      return false;
    }

    const derived = uv.freeRegion();
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

  #blockIdOf(
    regionId: string
  ): number | null {
    return this.#regions?.blockIdOf(regionId) ?? null;
  }

  #blockOf(
    id: string
  ): ResolvedBlockDefinition | undefined {
    const blockId = this.#blockIdOf(id);
    const block = blockId === null ?
      undefined :
      this.#view.document.blocks.get(blockId);

    return block !== undefined && this.#uvOf(block).textured ?
      block :
      undefined;
  }

  readonly #onRegionDeleted: UVMapListener<"region-deleted"> = (event) => {
    if (this.#rebuilding) {
      return;
    }

    const blockId = this.#blockIdOf(event.region.id);
    if (blockId === null) {
      return;
    }

    const block = this.#view.document.blocks.get(blockId);
    if (!block) {
      return;
    }

    this.#restoreRegionFor(block);
    this.#selection.refresh();
  };
}
