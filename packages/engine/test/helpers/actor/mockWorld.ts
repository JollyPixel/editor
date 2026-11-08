// Import Internal Dependencies
import { SceneManager } from "../../../src/core/systems/scene/SceneManager.ts";
import { ThreeSceneGraph } from "../../../src/three/scene/ThreeSceneGraph.ts";

export function createWorld() {
  return {
    sceneManager: new SceneManager(new ThreeSceneGraph())
  };
}
