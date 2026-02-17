// Import Third-party Dependencies
import * as THREE from "three";
import { ViewHelper } from "three/addons/helpers/ViewHelper.js";

// Import Internal Dependencies
import type { Systems } from "../index.ts";

export function createViewHelper(
  camera: THREE.Camera,
  world: Systems.World
): ViewHelper {
  const helper = new ViewHelper(
    camera,
    world.renderer.canvas
  );
  world.renderer.onDraw(() => {
    helper.render(world.renderer.getSource());
  });

  return helper;
}
