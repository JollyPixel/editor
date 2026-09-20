// Import Third-party Dependencies
import type {
  VoxelBlockInspector,
  VoxelBlockStats,
  VoxelBlockUsage,
  VoxelTilesetUsage
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../document/index.ts";

export type BlockUsageStoreEvents = {
  change: (stats: VoxelBlockStats) => void;
};

export type BlockUsageSource = Pick<
  VoxelBlockInspector,
  "stats" | "usageOf" | "tilesetUsageOf"
>;

export interface BlockUsageStoreOptions {
  mapDocument: MapDocumentSignals;
  source: BlockUsageSource;
}

export class BlockUsageStore extends Emitter<BlockUsageStoreEvents> {
  #source: BlockUsageSource;
  #stats: VoxelBlockStats;
  #pending = false;
  #subscriptions: Array<() => void>;

  constructor(
    options: BlockUsageStoreOptions
  ) {
    super();
    const { mapDocument, source } = options;

    this.#source = source;
    this.#stats = source.stats;

    const invalidate = () => this.invalidate();
    this.#subscriptions = [
      mapDocument.subscribe("layerUpdated", invalidate),
      mapDocument.subscribe("blockRegistryChanged", invalidate),
      mapDocument.subscribe("reset", invalidate)
    ];
  }

  get stats(): VoxelBlockStats {
    return this.#stats;
  }

  countOf(
    blockId: number
  ): number {
    return this.#stats.blocks.get(blockId) ?? 0;
  }

  voxelsIn(
    layerName: string
  ): number {
    return this.#stats.layers
      .find((layer) => layer.layerName === layerName)?.voxels ?? 0;
  }

  usageOf(
    blockId: number
  ): VoxelBlockUsage {
    return this.#source.usageOf(blockId);
  }

  tilesetUsageOf(
    tilesetId: string
  ): VoxelTilesetUsage {
    return this.#source.tilesetUsageOf(tilesetId);
  }

  invalidate(): void {
    if (this.#pending) {
      return;
    }

    this.#pending = true;
    queueMicrotask(() => {
      this.#pending = false;
      this.#stats = this.#source.stats;
      this.emit("change", this.#stats);
    });
  }

  dispose(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }
}
