// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { pass } from "three/tsl";

// Import Internal Dependencies
import { DirectRenderStrategy } from "../../../../src/systems/rendering/RenderStrategy.ts";
import type {
  RenderComponent,
  RenderViewport
} from "../../../../src/systems/rendering/Renderer.ts";

// CONSTANTS
const kSize = 32;
const kFrames = 3;

export interface ProbeOptions {
  forceWebGL: boolean;
  viewport?: RenderViewport;
  overlay?: boolean;
}

export interface ProbeResult {
  left: number[];
  right: number[];
}

function pixelAt(
  context: CanvasRenderingContext2D,
  x: number
): number[] {
  return Array.from(context.getImageData(x, kSize / 2, 1, 1).data);
}

export async function probe(
  options: ProbeOptions
): Promise<ProbeResult> {
  const renderer = new THREE.WebGPURenderer({
    forceWebGL: options.forceWebGL,
    antialias: false
  });
  renderer.setSize(kSize, kSize);
  await renderer.init();
  renderer.autoClear = false;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshBasicNodeMaterial({ color: 0xff0000 })
  );
  scene.add(plane);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;
  const component: RenderComponent = {
    threeCamera: camera,
    depth: 0,
    viewport: options.viewport ?? null,
    postProcessing: (context) => pass(context.scene, context.camera),
    prepareRender: () => void 0
  };
  const overlay = new THREE.Scene();
  const strategy = new DirectRenderStrategy(renderer);
  const sample = document.createElement("canvas");
  sample.width = kSize;
  sample.height = kSize;
  const context = sample.getContext("2d", { willReadFrequently: true })!;

  try {
    await new Promise<void>((resolve, reject) => {
      let remaining = kFrames;
      void renderer.setAnimationLoop(() => {
        try {
          strategy.render(scene, {
            components: [component],
            canvasWidth: kSize,
            canvasHeight: kSize
          });
          if (options.overlay) {
            renderer.setViewport(kSize - 8, 0, 8, 8);
            renderer.render(overlay, camera);
            renderer.setViewport(0, 0, kSize, kSize);
          }
          remaining--;
          if (remaining === 0) {
            context.drawImage(renderer.domElement, 0, 0);
            void renderer.setAnimationLoop(null);
            resolve();
          }
        }
        catch (error) {
          void renderer.setAnimationLoop(null);
          reject(error);
        }
      });
    });

    return {
      left: pixelAt(context, kSize / 4),
      right: pixelAt(context, kSize * 3 / 4)
    };
  }
  finally {
    strategy.dispose();
    plane.geometry.dispose();
    plane.material.dispose();
    renderer.dispose();
  }
}
