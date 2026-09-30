// Import Third-party Dependencies
import {
  PMREMGenerator,
  type Texture,
  type WebGPURenderer
} from "three/webgpu";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// CONSTANTS
const kBlurSigma = 0.04;

export async function createRoomEnvironment(
  renderer: WebGPURenderer
): Promise<Texture> {
  await renderer.init();

  const generator = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  try {
    return generator.fromScene(room, kBlurSigma).texture;
  }
  finally {
    room.dispose();
    generator.dispose();
  }
}
