// Import Third-party Dependencies
import {
  VoxelPatchBuilder,
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
  const patch = new VoxelPatchBuilder();
  for (const position of voxelCellPositions(command)) {
    if (kept.has(voxelKey(command.layerId, position))) {
      continue;
    }

    patch.push(
      position,
      layer.getPackedVoxelAt(position),
      layer.getPartnerVoxelAt(position)
    );
  }

  return {
    clientId: command.clientId,
    seq: command.seq,
    timestamp: command.timestamp,
    action: "voxels-patched",
    layerId: command.layerId,
    metadata: patch.toPatch()
  };
}
