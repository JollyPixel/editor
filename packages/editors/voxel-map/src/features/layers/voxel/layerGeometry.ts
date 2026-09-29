// Import Third-party Dependencies
import type { VoxelLayerCommand } from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kGeometryActions = new Set<VoxelLayerCommand["action"]>([
  "voxel-set",
  "voxel-removed",
  "voxels-set",
  "voxels-removed",
  "voxels-patched",
  "layer-transformed",
  "position-updated",
  "position-rebased"
]);

export function isLayerGeometryCommand(
  command: VoxelLayerCommand
): boolean {
  return kGeometryActions.has(command.action);
}
