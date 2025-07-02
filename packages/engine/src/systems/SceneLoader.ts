// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { GameInstance } from "./GameInstance.js";

// eslint-disable-next-line
/** @see https://github.com/superpowers/superpowers-game/blob/26d1f79e4a58a55de942f9d309f09ed0a1ceb8dc/plugins/default/scene/typescriptAPI/Sup.Scene.ts.txt */
export class SceneLoader {
  gameInstance: GameInstance;

  threeScene = new THREE.Scene();

  constructor(
    gameInstance: GameInstance
  ) {
    this.gameInstance = gameInstance;
  }

  load() {
    this.gameInstance.destroyAllActors();
  }
}
