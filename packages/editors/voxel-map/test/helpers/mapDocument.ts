// Import Third-party Dependencies
import {
  isVoxelLayerCommand,
  isVoxelTemplateCommand,
  type VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocumentEvents } from "../../src/document/MapDocument.ts";

export function mapDocumentOf(
  world: VoxelWorld
): Emitter<MapDocumentEvents> {
  const mapDocument = new Emitter<MapDocumentEvents>();
  world.on("command", (command) => {
    if (isVoxelLayerCommand(command)) {
      mapDocument.emit("layerUpdated", command);
    }
    else if (isVoxelTemplateCommand(command)) {
      mapDocument.emit("templatesChanged");
    }
  });

  return mapDocument;
}
