// Import Third-party Dependencies
import type {
  VoxelBlockInspector,
  VoxelBlockStats
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { EditorMapSignals } from "../../../map/EditorMap.ts";
import { BlocksetUsage } from "../../blocksets/BlocksetUsage.ts";
import { BlockUsage } from "./BlockUsage.ts";

export type BlockUsageStoreEvents = {
  change: (stats: VoxelBlockStats) => void;
};

export type BlockUsageSource = Pick<
  VoxelBlockInspector,
  "stats" | "inspectUsage" | "inspectBlocksetUsage"
>;

export interface BlockUsageStoreOptions {
  editorMap: EditorMapSignals;
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
    const { editorMap, source } = options;

    this.#source = source;
    this.#stats = source.stats;

    const invalidate = () => this.invalidate();
    this.#subscriptions = [
      editorMap.subscribe("layerUpdated", invalidate),
      editorMap.subscribe("blockRegistryChanged", (change) => {
        if (change !== "redefined" && change !== "retiled") {
          this.invalidate();
        }
      }),
      editorMap.subscribe("reset", invalidate)
    ];
  }

  get stats(): VoxelBlockStats {
    return this.#stats;
  }

  inspectUsage(
    blockId: number
  ): BlockUsage {
    return new BlockUsage(
      this.#source.inspectUsage(blockId)
    );
  }

  inspectBlocksetUsage(
    blocksetId: string
  ): BlocksetUsage {
    return new BlocksetUsage(
      this.#source.inspectBlocksetUsage(blocksetId)
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
