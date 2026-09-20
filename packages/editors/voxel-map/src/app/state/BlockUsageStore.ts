// Import Third-party Dependencies
import type {
  VoxelBlockInspector,
  VoxelBlockStats,
  VoxelBlockUsage,
  VoxelTilesetUsage
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { WorldStore } from "./WorldStore.ts";

export type BlockUsageStoreEvents = {
  change: (stats: VoxelBlockStats) => void;
};

export type BlockUsageSource = Pick<
  VoxelBlockInspector,
  "stats" | "usageOf" | "tilesetUsageOf"
>;

export function emptyBlockStats(): VoxelBlockStats {
  return {
    voxels: 0,
    layers: [],
    blocks: new Map(),
    unusedBlocks: [],
    orphanBlocks: [],
    orphanVoxels: 0
  };
}

export class BlockUsageStore extends Emitter<BlockUsageStoreEvents> {
  #source: BlockUsageSource | null = null;
  #stats = emptyBlockStats();
  #pending = false;

  constructor(
    world: WorldStore
  ) {
    super();

    const invalidate = () => this.invalidate();
    world.on("layerUpdated", invalidate);
    world.on("blockRegistryChanged", invalidate);
    world.on("reset", invalidate);
  }

  get stats(): VoxelBlockStats {
    return this.#stats;
  }

  attach(
    source: BlockUsageSource | null
  ): void {
    this.#source = source;
    this.#refresh();
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
    return this.#source?.usageOf(blockId) ?? {
      blockId,
      voxels: 0,
      layers: []
    };
  }

  tilesetUsageOf(
    tilesetId: string
  ): VoxelTilesetUsage {
    return this.#source?.tilesetUsageOf(tilesetId) ?? {
      tilesetId,
      blocks: [],
      voxels: 0
    };
  }

  invalidate(): void {
    if (this.#pending) {
      return;
    }

    this.#pending = true;
    queueMicrotask(() => {
      this.#pending = false;
      this.#refresh();
    });
  }

  #refresh(): void {
    this.#stats = this.#source?.stats ?? emptyBlockStats();
    this.emit("change", this.#stats);
  }
}
