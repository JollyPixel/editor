// Import Internal Dependencies
import { SceneManager } from "../../../src/systems/scene/SceneManager.ts";

export function createWorld() {
  return {
    sceneManager: new SceneManager()
  };
}
