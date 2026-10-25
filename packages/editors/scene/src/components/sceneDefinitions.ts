// Import Third-party Dependencies
import {
  CameraDefinition,
  LightDefinition,
  MeshDefinition,
  ScriptDefinition,
  Systems
} from "@jolly-pixel/engine";
import { VoxelMapDefinition } from "@jolly-pixel/voxel.renderer/engine";

export function createSceneDefinitions(): Systems.ComponentDefinitions {
  return new Systems.ComponentDefinitions().register(
    new CameraDefinition(),
    new LightDefinition(),
    new MeshDefinition(),
    new ScriptDefinition({}),
    new VoxelMapDefinition()
  );
}
