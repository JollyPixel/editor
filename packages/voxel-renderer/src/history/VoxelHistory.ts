// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import {
  VOXEL_ABSENT,
  voxelBlockId,
  voxelTransform,
  type PackedVoxel
} from "../world/packedVoxel.ts";
import { VoxelTransform } from "../world/VoxelTransform.ts";
import type {
  VoxelCellChange,
  VoxelCoord,
  VoxelEditRecorder
} from "../world/types.ts";
import type {
  VoxelRemoveOptions,
  VoxelSetOptions
} from "../types.ts";
import type {
  VoxelHistoryEntry,
  VoxelHistoryEvents
} from "./VoxelHistory.types.ts";

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
      world.recorder = this.#recorder;
    }
  }

  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.#redoStack.length > 0;
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
      [...group.values()].filter((change) => change.before !== change.after)
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
    if (this.#world.recorder === this.#recorder) {
      this.#world.recorder = null;
    }
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
        previous === undefined ? change : { ...previous, after: change.after }
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
    const removals = new Map<string, VoxelRemoveOptions[]>();
    const writes = new Map<string, VoxelSetOptions[]>();

    for (const change of entry.changes) {
      const [expected, target] = direction === "undo" ?
        [change.after, change.before] :
        [change.before, change.after];

      const { layerName, position } = change;
      const layer = this.#world.getLayer(layerName);
      if (layer?.getPackedVoxelAt(position) !== expected) {
        continue;
      }

      if (target === VOXEL_ABSENT) {
        append(removals, layerName, { position });
      }
      else {
        append(writes, layerName, toSetOptions(position, target));
      }
    }

    const world = this.#world;
    const recorder = world.recorder;
    world.recorder = null;
    try {
      for (const [layerName, entries] of removals) {
        world.removeVoxelBulk(layerName, entries);
      }
      for (const [layerName, entries] of writes) {
        world.setVoxelBulk(layerName, entries);
      }
    }
    finally {
      world.recorder = recorder;
    }
  }

  #notify(): void {
    this.emit("change", {
      canUndo: this.canUndo,
      canRedo: this.canRedo
    });
  }
}

function cellKey(
  change: VoxelCellChange
): string {
  const { x, y, z } = change.position;

  return `${x},${y},${z}:${change.layerName}`;
}

function append<T>(
  map: Map<string, T[]>,
  key: string,
  value: T
): void {
  const values = map.get(key);
  if (values === undefined) {
    map.set(key, [value]);
  }
  else {
    values.push(value);
  }
}

function toSetOptions(
  position: VoxelCoord,
  packed: PackedVoxel
): VoxelSetOptions {
  const transform = VoxelTransform.fromPacked(voxelTransform(packed));

  return {
    position,
    blockId: voxelBlockId(packed),
    rotation: transform.rotation,
    flipX: transform.flipX,
    flipZ: transform.flipZ,
    flipY: transform.flipY
  };
}
