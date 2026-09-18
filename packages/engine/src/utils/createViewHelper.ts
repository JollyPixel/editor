// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { ViewHelper } from "three/addons/helpers/ViewHelper.js";

// Import Internal Dependencies
import type { Systems } from "../index.ts";

export interface ViewHelperBinding {
  helper: ViewHelper;
  dispose(): void;
}

export function createViewHelper(
  camera: THREE.Camera,
  world: Systems.World
): ViewHelperBinding {
  const helper = new ViewHelper(
    camera,
    world.renderer.canvas
  );
  /*
   * ViewHelper's runtime checks `renderer.isWebGPURenderer` and supports
   * WebGPURenderer, but @types/three's declaration hasn't caught up and
   * still narrows `render()` to WebGLRenderer only.
   */
  const renderer = world.renderer.getSource() as unknown as Parameters<ViewHelper["render"]>[0];
  function draw() {
    helper.render(renderer);
  }
  world.renderer.on("draw", draw);

  return {
    helper,
    dispose() {
      world.renderer.off("draw", draw);
      helper.dispose();
    }
  };
}
