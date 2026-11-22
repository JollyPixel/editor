// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";
import * as THREE from "three/webgpu";
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import {
  CameraCompositor
} from "../src/rendering/compositing/CameraCompositor.ts";
import type { ThreeRenderComponent } from "../src/rendering/ThreeRenderComponent.ts";

const suite = defineSuite("backend.three / CameraCompositor#render", (bench) => {
  const scene = new THREE.Scene();
  const canvas = new Systems.CanvasDimensions(1920, 1080);

  const single = new CameraCompositor(createRenderer());
  single.add(createCamera(0, null));

  const split = new CameraCompositor(createRenderer());
  split.add(createCamera(1, { x: 0, y: 0, width: 0.5, height: 1 }));
  split.add(createCamera(0, { x: 0.5, y: 0, width: 0.5, height: 1 }));
  split.add(createCamera(2, null));

  bench
    .add("one fullscreen camera", () => {
      single.render(scene, canvas, null);
    })
    .add("three cameras with viewports", () => {
      split.render(scene, canvas, null);
    });
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}

function createCamera(
  depth: number,
  viewport: Systems.RenderViewport | null
): ThreeRenderComponent {
  return {
    threeCamera: new THREE.PerspectiveCamera(),
    depth,
    viewport: viewport === null ? null : new Systems.Viewport(viewport),
    prepareRender() {
      return;
    }
  };
}

function createRenderer(): THREE.WebGPURenderer {
  const renderer = {
    setViewport() {
      return;
    },
    setScissor() {
      return;
    },
    setScissorTest() {
      return;
    },
    clear() {
      return;
    },
    render() {
      return;
    }
  };

  return renderer as unknown as THREE.WebGPURenderer;
}
