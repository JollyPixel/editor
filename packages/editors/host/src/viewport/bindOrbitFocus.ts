// Import Third-party Dependencies
import type { KeyBindings } from "@jolly-pixel/controls";
import type { OrbitFlyCamera } from "@jolly-pixel/engine";
import type { LogQueue } from "@jolly-pixel/ui";

export type OrbitFocusCamera = Pick<
  OrbitFlyCamera,
  | "isOrbiting"
  | "exitOrbitFocus"
  | "subscribe"
>;

export interface OrbitFocusOptions {
  keyboard: Pick<KeyBindings, "bind">;
  log: Pick<LogQueue, "push">;
}

export function bindOrbitFocus(
  camera: OrbitFocusCamera,
  options: OrbitFocusOptions
): () => void {
  const unbindEscape = options.keyboard.bind("Escape", () => {
    if (!camera.isOrbiting) {
      return false;
    }
    camera.exitOrbitFocus();

    return true;
  });
  const unsubscribe = camera.subscribe("orbit", (orbiting) => {
    options.log.push(
      orbiting
        ? "Camera switched to pivot"
        : "Camera switched to free fly"
    );
  });

  return () => {
    unbindEscape();
    unsubscribe();
  };
}
