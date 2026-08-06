// Import Third-party Dependencies
import * as THREE from "three/webgpu";
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
    // ViewHelper's runtime checks `renderer.isWebGPURenderer` and supports
    // WebGPURenderer, but @types/three's declaration hasn't caught up and
    // still narrows `render()` to WebGLRenderer only.
    helper.render(world.renderer.getSource() as unknown as Parameters<ViewHelper["render"]>[0]);
  });

  return helper;
}
