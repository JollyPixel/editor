// Import Third-party Dependencies
import * as THREE from "three/webgpu";

export function pointerNdc(
  canvas: HTMLCanvasElement,
  event: PointerEvent,
  target = new THREE.Vector2()
): THREE.Vector2 {
  const rect = canvas.getBoundingClientRect();

  return target.set(
    (((event.clientX - rect.left) / rect.width) * 2) - 1,
    (-((event.clientY - rect.top) / rect.height) * 2) + 1
  );
}
