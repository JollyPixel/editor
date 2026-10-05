// Import Third-party Dependencies
import {
  pickVoxelPatch,
  VOXEL_PATCH_STRIDE,
  type VoxelCoord,
  type VoxelLayerCommand
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelMapNetworkCommand } from "./types.ts";

// CONSTANTS
const kVoxelCellActions = new Set<string>([
  "voxel-set",
  "voxel-removed",
  "voxels-set",
  "voxels-removed",
  "voxels-patched"
]);

type KeyedCommand = VoxelLayerCommand | VoxelMapNetworkCommand;

export type VoxelCellCommand = Extract<
  KeyedCommand,
  {
    action:
      | "voxel-set"
      | "voxel-removed"
      | "voxels-set"
      | "voxels-removed"
      | "voxels-patched";
  }
>;

export function voxelKey(
  layerId: string,
  position: { x: number; y: number; z: number; }
): string {
  const { x, y, z } = position;

  return `${layerId}:${x},${y},${z}`;
}

export function isVoxelCellCommand<TCommand extends KeyedCommand>(
  command: TCommand
): command is Extract<TCommand, VoxelCellCommand> {
  return kVoxelCellActions.has(command.action);
}

export function voxelCellPositions(
  command: VoxelCellCommand
): VoxelCoord[] {
  switch (command.action) {
    case "voxel-set":
    case "voxel-removed":
      return [coordOf(command.metadata.position)];
    case "voxels-set":
    case "voxels-removed":
      return command.metadata.entries.map((entry) => coordOf(entry.position));
    default: {
      const { cells } = command.metadata;
      const positions: VoxelCoord[] = [];
      for (let offset = 0; offset < cells.length; offset += VOXEL_PATCH_STRIDE) {
        positions.push({
          x: cells[offset],
          y: cells[offset + 1],
          z: cells[offset + 2]
        });
      }

      return positions;
    }
  }
}

export function voxelCellKeys(
  command: VoxelCellCommand
): string[] {
  return voxelCellPositions(command).map(
    (position) => voxelKey(command.layerId, position)
  );
}

export function voxelCommandKey(
  command: KeyedCommand
): string | null {
  switch (command.action) {
    case "voxel-set":
    case "voxel-removed":
      return voxelKey(command.layerId, command.metadata.position);
    case "layer-moved":
      return `layer-order:${command.layerId}`;
    case "object-added":
      return `object:${command.metadata.object.id}`;
    case "object-removed":
    case "object-updated":
    case "object-moved":
      return `object:${command.metadata.objectId}`;
    case "template-defined":
      return `template:${command.template.id}`;
    case "template-updated":
    case "template-removed":
      return `template:${command.templateId}`;
    case "tileset-added":
      return `tileset:${command.tileset.id}`;
    case "tileset-removed":
      return `tileset:${command.tilesetId}`;
    default:
      return null;
  }
}

export function voxelCommandKeys(
  command: KeyedCommand
): string[] {
  if (isVoxelCellCommand(command)) {
    return voxelCellKeys(command);
  }

  const key = voxelCommandKey(command);

  return key === null ? [] : [key];
}

export function narrowVoxelCellCommand<TCommand extends VoxelCellCommand>(
  command: TCommand,
  keep: readonly number[]
): TCommand | null {
  switch (command.action) {
    case "voxels-set":
    case "voxels-removed": {
      const { entries } = command.metadata;

      return {
        ...command,
        metadata: {
          entries: keep.map((index) => entries[index])
        }
      };
    }
    case "voxels-patched":
      return {
        ...command,
        metadata: pickVoxelPatch(command.metadata, keep)
      };
    default:
      return keep.length === 1 ? command : null;
  }
}

function coordOf(
  position: { x: number; y: number; z: number; }
): VoxelCoord {
  return {
    x: position.x,
    y: position.y,
    z: position.z
  };
}
