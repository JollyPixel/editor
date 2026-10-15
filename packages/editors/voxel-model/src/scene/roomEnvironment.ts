// Import Third-party Dependencies
import {
  PMREMGenerator,
  type Texture,
  type WebGPURenderer
} from "three/webgpu";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// CONSTANTS
const kBlurSigma = 0.04;

export function createRoomEnvironment(
  renderer: WebGPURenderer
): Texture | null {
  const generator = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  try {
    return generator.fromScene(room, kBlurSigma).texture;
  }
  catch (error) {
    console.warn("[voxel-model] No environment map for the viewport.", error);

    return null;
  }
  finally {
    room.dispose();
    generator.dispose();
  }
}
