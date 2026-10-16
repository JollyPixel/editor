// Import Third-party Dependencies
import {
  PMREMGenerator,
  type RenderTarget,
  type Texture,
  type WebGPURenderer
} from "three/webgpu";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Systems } from "@jolly-pixel/engine";

// CONSTANTS
const kBlurSigma = 0.04;
const kNear = 0.1;
const kFar = 100;

export function createRoomEnvironment(
  renderer: Systems.Renderer<WebGPURenderer>
): Texture | null {
  const generator = new PMREMGenerator(renderer.getSource());
  const room = new RoomEnvironment();
  function release(): void {
    room.dispose();
    generator.dispose();
  }

  let target: RenderTarget;
  try {
    target = generator.fromScene(room, kBlurSigma);
  }
  catch (error) {
    console.warn("[voxel-model] No environment map for the viewport.", error);
    release();

    return null;
  }

  let disposed = false;
  target.texture.addEventListener("dispose", () => {
    disposed = true;
  });
  renderer.compiled()
    .then(() => {
      if (!disposed) {
        generator.fromScene(room, kBlurSigma, kNear, kFar, {
          renderTarget: target
        });
      }
    })
    .catch((error) => {
      console.warn("[voxel-model] No environment map for the viewport.", error);
    })
    .finally(release);

  return target.texture;
}
