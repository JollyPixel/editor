// Import Third-party Dependencies
import type {
  VoxelBlockInspector,
  VoxelBlockStats
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../../document/MapDocument.ts";
import { TilesetUsage } from "../../tilesets/TilesetUsage.ts";
import { BlockUsage } from "./BlockUsage.ts";

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
      mapDocument.subscribe("blockRegistryChanged", (change) => {
        if (change !== "redefined" && change !== "retiled") {
          this.invalidate();
        }
      }),
      mapDocument.subscribe("reset", invalidate)
    ];
  }

  get stats(): VoxelBlockStats {
    return this.#stats;
  }

  usageOf(
    blockId: number
  ): BlockUsage {
    return new BlockUsage(
      this.#source.usageOf(blockId)
    );
  }

  tilesetUsageOf(
    tilesetId: string
  ): TilesetUsage {
    return new TilesetUsage(
      this.#source.tilesetUsageOf(tilesetId)
    );
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
