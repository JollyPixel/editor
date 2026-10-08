// Import Third-party Dependencies
import type {
  HistoryGuard,
  HistoryKeys,
  HistoryRegistration
} from "@jolly-pixel/history";
import {
  VOXEL_ABSENT,
  VOXEL_PATCH_STRIDE,
  voxelPatchWrites,
  VoxelPatchBuilder,
  type VoxelCoord,
  type VoxelPatchWrite,
  type VoxelWorld,
  type VoxelWorldCommand
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  VoxelChange,
  VoxelEdits
} from "./VoxelEdits.ts";
import {
  VoxelKeySet,
  type VoxelKeyCell
} from "./VoxelKeySet.ts";

// CONSTANTS
const kDefaultId = "voxels";
const kLabel = "Edit voxels";

export interface VoxelHistoryRegistrationOptions<TScope extends string> {
  /**
   * @default "voxels"
   */
  id?: string;
  scope: TScope;
}

export function voxelHistoryRegistration<TScope extends string>(
  edits: VoxelEdits,
  options: VoxelHistoryRegistrationOptions<TScope>
): HistoryRegistration<TScope, VoxelWorldCommand, null, VoxelKeySet, Int32Array> {
  const { id = kDefaultId, scope } = options;

  return {
    id,
    document: edits,
    keys: voxelHistoryKeys(edits.world),
    scopeOf: () => scope,
    label: () => kLabel,
    compact: compactVoxelPatches
  };
}

export function voxelHistoryKeys(
  world: VoxelWorld
): HistoryKeys<VoxelWorldCommand, null, VoxelKeySet, Int32Array> {
  return {
    written: (change) => writtenKeys(change),
    guard: (commands) => new VoxelGuard(world, commands)
  };
}

class VoxelGuard implements HistoryGuard<VoxelKeySet, Int32Array> {
  readonly keys: VoxelKeySet;

  #world: VoxelWorld;

  constructor(
    world: VoxelWorld,
    commands: readonly VoxelWorldCommand[]
  ) {
    this.#world = world;
    this.keys = new VoxelKeySet(commands.flatMap(cellsOf));
  }

  touches(
    written: VoxelKeySet
  ): boolean {
    return this.keys.overlaps(written);
  }

  capture(): Int32Array {
    const values = new Int32Array(this.keys.cellCount * 2);
    let offset = 0;
    for (const { layerId, position } of this.keys.cells()) {
      const layer = this.#world.getLayerById(layerId);
      values[offset++] = layer?.getPackedVoxelAt(position) ?? VOXEL_ABSENT;
      values[offset++] = layer?.getPartnerVoxelAt(position) ?? VOXEL_ABSENT;
    }

    return values;
  }

  same(
    captured: Int32Array
  ): boolean {
    const values = this.capture();

    return values.length === captured.length &&
      values.every((value, index) => value === captured[index]);
  }
}

function writtenKeys(
  change: VoxelChange
): VoxelKeySet {
  const { command, origin } = change;
  switch (command.action) {
    case "voxel-set":
    case "voxel-removed":
    case "voxels-set":
    case "voxels-removed":
    case "voxels-patched":
      return new VoxelKeySet(cellsOf(command));
    case "layer-transformed":
      return new VoxelKeySet([], [command.layerId]);
    case "removed":
    case "position-updated":
      return new VoxelKeySet([], origin === "remote" ? [command.layerId] : []);
    case "merged":
      return new VoxelKeySet(
        [],
        origin === "remote" ? [command.layerId, command.metadata.targetLayerId] : []
      );
    default:
      return new VoxelKeySet([]);
  }
}

function cellsOf(
  command: VoxelWorldCommand
): VoxelKeyCell[] {
  switch (command.action) {
    case "voxel-set":
    case "voxel-removed":
      return [cellOf(command.layerId, command.metadata.position)];
    case "voxels-set":
    case "voxels-removed":
      return command.metadata.entries.map(
        ({ position }) => cellOf(command.layerId, position)
      );
    case "voxels-patched": {
      const { cells } = command.metadata;
      const keyCells: VoxelKeyCell[] = [];
      for (let offset = 0; offset < cells.length; offset += VOXEL_PATCH_STRIDE) {
        keyCells.push(cellOf(command.layerId, {
          x: cells[offset],
          y: cells[offset + 1],
          z: cells[offset + 2]
        }));
      }

      return keyCells;
    }
    default:
      return [];
  }
}

function cellOf(
  layerId: string,
  position: VoxelCoord
): VoxelKeyCell {
  return {
    layerId,
    position: {
      x: position.x,
      y: position.y,
      z: position.z
    }
  };
}

function compactVoxelPatches(
  commands: readonly VoxelWorldCommand[]
): VoxelWorldCommand[] {
  const layers = new Map<string, Map<string, VoxelPatchWrite>>();
  const kept: VoxelWorldCommand[] = [];
  for (const command of commands) {
    if (command.action !== "voxels-patched") {
      kept.push(command);
      continue;
    }

    let cells = layers.get(command.layerId);
    if (cells === undefined) {
      cells = new Map();
      layers.set(command.layerId, cells);
    }
    for (const cell of voxelPatchWrites(command.metadata)) {
      cells.set(cellKey(cell.position), cell);
    }
  }

  for (const [layerId, cells] of layers) {
    const patch = new VoxelPatchBuilder();
    for (const { position, packed, partner } of cells.values()) {
      patch.push(position, packed, partner);
    }
    kept.push({
      action: "voxels-patched",
      layerId,
      metadata: patch.toPatch()
    });
  }

  return kept;
}

function cellKey(
  position: VoxelCoord
): string {
  return `${position.x},${position.y},${position.z}`;
}
