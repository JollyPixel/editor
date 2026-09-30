// Import Third-party Dependencies
import {
  AIR_BLOCK_ID,
  VOXEL_ABSENT,
  voxelBlockId,
  voxelTransform,
  type VoxelWorldCommandTarget
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelMapNetworkCommand } from "./types.ts";
import {
  isVoxelCellCommand,
  voxelCellKeys,
  voxelCellPositions,
  voxelKey
} from "./VoxelCommandKeys.ts";

export function correctVoxelCommand(
  state: VoxelWorldCommandTarget,
  command: VoxelMapNetworkCommand,
  admitted: VoxelMapNetworkCommand | null
): VoxelMapNetworkCommand | null {
  if (!isVoxelCellCommand(command)) {
    return null;
  }

  const layer = state.world.getLayerById(command.layerId);
  if (layer === undefined) {
    return null;
  }

  const kept = new Set(
    admitted !== null && isVoxelCellCommand(admitted) ?
      voxelCellKeys(admitted) :
      []
  );
  const cells: number[] = [];
  for (const position of voxelCellPositions(command)) {
    if (kept.has(voxelKey(command.layerId, position))) {
      continue;
    }

    const packed = layer.getPackedVoxelAt(position);
    const absent = packed === VOXEL_ABSENT;
    cells.push(
      position.x,
      position.y,
      position.z,
      absent ? AIR_BLOCK_ID : voxelBlockId(packed),
      absent ? 0 : voxelTransform(packed)
    );
  }

  return {
    clientId: command.clientId,
    seq: command.seq,
    timestamp: command.timestamp,
    action: "voxels-patched",
    layerId: command.layerId,
    metadata: { cells }
  };
}
