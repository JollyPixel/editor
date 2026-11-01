// Import Third-party Dependencies
import type { KeyBindings } from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { OrbitFlyCamera } from "./OrbitFlyCamera.ts";

export type OrbitFocusCamera = Pick<
  OrbitFlyCamera,
  | "isOrbiting"
  | "exitOrbitFocus"
>;

export function bindOrbitFocus(
  camera: OrbitFocusCamera,
  keyboard: Pick<KeyBindings, "bind">
): () => void {
  return keyboard.bind("Escape", () => {
    if (!camera.isOrbiting) {
      return false;
    }
    camera.exitOrbitFocus();

    return true;
  });
}
