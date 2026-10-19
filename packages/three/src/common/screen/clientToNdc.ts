// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { ClientTarget } from "./projectToClient.ts";

export function clientToNdc(
  canvas: ClientTarget,
  clientX: number,
  clientY: number,
  target = new THREE.Vector2()
): THREE.Vector2 | null {
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) {
    return null;
  }

  return target.set(
    (((clientX - bounds.left) / bounds.width) * 2) - 1,
    1 - (((clientY - bounds.top) / bounds.height) * 2)
  );
}
