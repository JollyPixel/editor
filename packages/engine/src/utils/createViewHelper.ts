// Import Third-party Dependencies
import * as THREE from "three";
import { ViewHelper } from "three/addons/helpers/ViewHelper.js";

// Import Internal Dependencies
import type { Systems } from "../index.js";

export function createViewHelper(
  camera: THREE.Camera,
  gameInstance: Systems.GameInstance
): ViewHelper {
  const helper = new ViewHelper(
    camera,
    gameInstance.renderer.canvas
  );
  gameInstance.renderer.onDraw(() => {
    helper.render(gameInstance.renderer.getSource());
  });

  return helper;
}
