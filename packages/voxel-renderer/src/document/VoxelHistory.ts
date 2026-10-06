// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { VoxelWorld } from "./world/VoxelWorld.ts";
import { sameCell } from "./world/storage/mergedVoxel.ts";
import type {
  VoxelCellChange,
  VoxelEditRecorder
} from "./world/types.ts";
import { VoxelPatchBuilder } from "./world/editing/VoxelPatchBuilder.ts";

// CONSTANTS
const kDefaultLimit = 10;

export interface VoxelHistoryOptions {
  /**
   * @default false
   */
  enabled?: boolean;
  /**
   * Maximum number of undoable entries; the oldest is dropped first.
   * @default 10
   */
  limit?: number;
}

export interface VoxelHistoryEntry {
  readonly changes: readonly VoxelCellChange[];
}

export interface VoxelHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
}

export type VoxelHistoryEvents = {
  change: (state: VoxelHistoryState) => void;
};

type ReplayDirection = "undo" | "redo";

export class VoxelHistory extends Emitter<VoxelHistoryEvents> {
  readonly enabled: boolean;
  readonly limit: number;

  #world: VoxelWorld;
  #recorder: VoxelEditRecorder = {
    record: (changes) => this.#record(changes)
  };
  #undoStack: VoxelHistoryEntry[] = [];
  #redoStack: VoxelHistoryEntry[] = [];
  #group: Map<string, VoxelCellChange> | null = null;
  #depth = 0;

  constructor(
    world: VoxelWorld,
    options: VoxelHistoryOptions = {}
  ) {
    super();

    const {
      enabled = false,
      limit = kDefaultLimit
    } = options;
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError(
        `VoxelHistory: limit must be a positive integer, got ${limit}.`
      );
    }

    this.#world = world;
    this.enabled = enabled;
    this.limit = limit;
    if (enabled) {
      world.addRecorder(this.#recorder);
    }
  }

  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  get undoDepth(): number {
    return this.#undoStack.length;
  }

  get redoDepth(): number {
    return this.#redoStack.length;
  }

  begin(): void {
    if (!this.enabled) {
      return;
    }

    this.#depth++;
    this.#group ??= new Map();
  }

  commit(): void {
    if (this.#depth === 0) {
      return;
    }

    this.#depth--;
    const group = this.#group;
    if (this.#depth > 0 || group === null) {
      return;
    }

    this.#group = null;
    this.#push(
      [...group.values()].filter((change) => !sameCell(
        change.before,
        change.beforePartner,
        change.after,
        change.afterPartner
      ))
    );
  }

  undo(): boolean {
    return this.#step(this.#undoStack, this.#redoStack, "undo");
  }

  redo(): boolean {
    return this.#step(this.#redoStack, this.#undoStack, "redo");
  }

  clear(): void {
    if (this.#group !== null) {
      this.#group = new Map();
    }
    if (!this.canUndo && !this.canRedo) {
      return;
    }

    this.#undoStack = [];
    this.#redoStack = [];
    this.#notify();
  }

  dispose(): void {
    this.#world.removeRecorder(this.#recorder);
    this.#undoStack = [];
    this.#redoStack = [];
    this.#group = null;
    this.#depth = 0;
    this.removeAllListeners();
  }

  #record(
    changes: VoxelCellChange[]
  ): void {
    if (this.#group === null) {
      this.#push(changes);

      return;
    }

    for (const change of changes) {
      const key = cellKey(change);
      const previous = this.#group.get(key);

      this.#group.set(
        key,
        previous === undefined ?
          change :
          {
            ...previous,
            after: change.after,
            afterPartner: change.afterPartner
          }
      );
    }
  }

  #push(
    changes: VoxelCellChange[]
  ): void {
    if (changes.length === 0) {
      return;
    }

    this.#undoStack.push({ changes });
    if (this.#undoStack.length > this.limit) {
      this.#undoStack.shift();
    }
    this.#redoStack = [];
    this.#notify();
  }

  #step(
    from: VoxelHistoryEntry[],
    to: VoxelHistoryEntry[],
    direction: ReplayDirection
  ): boolean {
    if (this.#depth > 0) {
      return false;
    }

    const entry = from.pop();
    if (entry === undefined) {
      return false;
    }

    this.#replay(entry, direction);
    to.push(entry);
    this.#notify();

    return true;
  }

  #replay(
    entry: VoxelHistoryEntry,
    direction: ReplayDirection
  ): void {
    const world = this.#world;
    const patches = new Map<string, VoxelPatchBuilder>();

    for (const change of entry.changes) {
      const undo = direction === "undo";
      const expected = undo ? change.after : change.before;
      const expectedPartner = undo ? change.afterPartner : change.beforePartner;
      const target = undo ? change.before : change.after;
      const targetPartner = undo ? change.beforePartner : change.afterPartner;

      const { layerId, position } = change;
      const layer = world.getLayerById(layerId);
      if (
        layer?.getPackedVoxelAt(position) !== expected ||
        layer.getPartnerVoxelAt(position) !== expectedPartner
      ) {
        continue;
      }

      let patch = patches.get(layerId);
      if (patch === undefined) {
        patch = new VoxelPatchBuilder();
        patches.set(layerId, patch);
      }
      patch.push(position, target, targetPartner);
    }

    world.unrecorded(() => world.transaction(() => {
      for (const [layerId, patch] of patches) {
        const { cells, partners } = patch.toPatch();
        world.patchVoxels(world.getLayerById(layerId)!.name, cells, partners);
      }
    }));
  }

  #notify(): void {
    this.emit("change", {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      undoDepth: this.undoDepth,
      redoDepth: this.redoDepth
    });
  }
}

function cellKey(
  change: VoxelCellChange
): string {
  const { x, y, z } = change.position;

  return `${x},${y},${z}:${change.layerId}`;
}
