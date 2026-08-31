// Import Internal Dependencies
import type { VoxelLayerHookEvent } from "../hooks.ts";
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import { VoxelTransform } from "../world/VoxelTransform.ts";

/**
 * Applies one hook event to a headless `VoxelWorld`.
 */
export function applyCommandToWorld(
  world: VoxelWorld,
  cmd: VoxelLayerHookEvent
): void {
  switch (cmd.action) {
    case "added":
      world.addLayer(
        cmd.layerName,
        cmd.metadata.options
      );
      break;

    case "removed":
      world.removeLayer(
        cmd.layerName
      );
      break;

    case "updated":
      world.updateLayer(
        cmd.layerName,
        cmd.metadata.options
      );
      break;

    case "offset-updated":
      if ("offset" in cmd.metadata) {
        world.setLayerOffset(
          cmd.layerName,
          cmd.metadata.offset
        );
      }
      else {
        world.translateLayer(
          cmd.layerName,
          cmd.metadata.delta
        );
      }
      break;

    case "voxel-set":
      world.setVoxelAt(cmd.layerName, cmd.metadata.position, {
        blockId: cmd.metadata.blockId,
        transform: new VoxelTransform(cmd.metadata).packed
      });
      break;

    case "voxel-removed":
      world.removeVoxelAt(
        cmd.layerName,
        cmd.metadata.position
      );
      break;

    case "voxels-set":
      for (const entry of cmd.metadata.entries) {
        world.setVoxelAt(cmd.layerName, entry.position, {
          blockId: entry.blockId,
          transform: new VoxelTransform(entry).packed
        });
      }
      break;

    case "voxels-removed":
      for (const entry of cmd.metadata.entries) {
        world.removeVoxelAt(
          cmd.layerName,
          entry.position
        );
      }
      break;

    case "reordered":
      world.moveLayer(
        cmd.layerName,
        cmd.metadata.direction
      );
      break;

    case "merged":
      world.mergeLayer(
        cmd.layerName,
        cmd.metadata.targetLayerName
      );
      break;

    case "object-layer-added":
      world.addObjectLayer(
        cmd.layerName
      );
      break;

    case "object-layer-removed":
      world.removeObjectLayer(
        cmd.layerName
      );
      break;

    case "object-layer-updated":
      world.updateObjectLayer(
        cmd.layerName,
        cmd.metadata.patch
      );
      break;

    case "object-added":
      world.addObjectToLayer(
        cmd.layerName,
        cmd.metadata.object
      );
      break;

    case "object-removed":
      world.removeObjectFromLayer(
        cmd.layerName,
        cmd.metadata.objectId
      );
      break;

    case "object-updated":
      world.updateObjectInLayer(
        cmd.layerName,
        cmd.metadata.objectId,
        cmd.metadata.patch
      );
      break;
  }
}
