// Import Internal Dependencies
import type { VoxelLayerHookEvent } from "../hooks.ts";
import type { VoxelWorld } from "./VoxelWorld.ts";

/**
 * Replays one hook event onto a world.
 */
export function dispatchCommand(
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

    case "cloned":
      world.cloneLayer(
        cmd.layerName,
        cmd.metadata.options
      );
      break;

    case "merged":
      world.mergeLayer(
        cmd.layerName,
        cmd.metadata.targetLayerName
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
      world.setVoxel(
        cmd.layerName,
        cmd.metadata
      );
      break;

    case "voxel-removed":
      world.removeVoxel(
        cmd.layerName,
        cmd.metadata
      );
      break;

    case "voxels-set":
      world.setVoxelBulk(
        cmd.layerName,
        cmd.metadata.entries
      );
      break;

    case "voxels-removed":
      world.removeVoxelBulk(
        cmd.layerName,
        cmd.metadata.entries
      );
      break;

    case "reordered":
      world.moveLayer(
        cmd.layerName,
        cmd.metadata.direction
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

    default: {
      const unhandled: never = cmd;
      throw new Error(
        `dispatchCommand: unhandled action '${(unhandled as VoxelLayerHookEvent).action}'.`
      );
    }
  }
}
