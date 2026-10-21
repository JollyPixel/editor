// Import Third-party Dependencies
import {
  isVoxelLayerCommand,
  isVoxelTemplateCommand,
  type VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { EditorMapEvents } from "../../src/map/EditorMap.ts";

export function createEditorMap(
  world: VoxelWorld
): Emitter<EditorMapEvents> {
  const editorMap = new Emitter<EditorMapEvents>();
  world.on("command", (command) => {
    if (isVoxelLayerCommand(command)) {
      editorMap.emit("layerUpdated", command);
    }
    else if (isVoxelTemplateCommand(command)) {
      editorMap.emit("templatesChanged");
    }
  });

  return editorMap;
}
