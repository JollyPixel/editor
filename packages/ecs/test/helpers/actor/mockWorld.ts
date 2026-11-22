// Import Internal Dependencies
import { SceneManager } from "../../../src/systems/scene/SceneManager.ts";
import { HeadlessSceneGraph } from "../../../src/systems/scene/HeadlessSceneGraph.ts";

export function createWorld() {
  return {
    sceneManager: new SceneManager(new HeadlessSceneGraph())
  };
}
