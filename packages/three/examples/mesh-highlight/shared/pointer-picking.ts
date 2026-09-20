// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { pointerNdc } from "../../shared/pointer.ts";

// CONSTANTS
const kClickDragThresholdPx = 4;

export interface PointerPickingOptions<T> {
  camera: THREE.Camera;
  pick: (raycaster: THREE.Raycaster) => T | null;
  onHover: (hit: T | null) => void;
  onClick: (hit: T | null) => void;
}

export function onCanvasPick<T>(
  canvas: HTMLCanvasElement,
  options: PointerPickingOptions<T>
): void {
  const { camera, pick, onHover, onClick } = options;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pointerDownAt: { x: number; y: number; } | null = null;

  function hitAt(
    event: PointerEvent
  ): T | null {
    raycaster.setFromCamera(
      pointerNdc(canvas, event, ndc),
      camera
    );

    return pick(raycaster);
  }

  canvas.addEventListener("pointermove", (event) => {
    onHover(hitAt(event));
  });

  canvas.addEventListener("pointerdown", (event) => {
    pointerDownAt = { x: event.clientX, y: event.clientY };
  });

  canvas.addEventListener("pointerup", (event) => {
    const downAt = pointerDownAt;
    pointerDownAt = null;
    if (downAt === null) {
      return;
    }

    const movedPx = Math.hypot(
      event.clientX - downAt.x,
      event.clientY - downAt.y
    );
    if (movedPx > kClickDragThresholdPx) {
      return;
    }

    onClick(hitAt(event));
  });
}
