// Import Internal Dependencies
import type { TurntablePose } from "./TurntablePose.ts";

// CONSTANTS
const kRadiansPerPixel = 0.012;
const kAriaLabel = "Preview, drag or use arrow keys to rotate";
const kKeySteps = new Map<string, (pose: TurntablePose) => void>([
  ["ArrowLeft", (pose) => pose.stepYaw(-1)],
  ["ArrowRight", (pose) => pose.stepYaw(1)],
  ["ArrowUp", (pose) => pose.stepPitch(-1)],
  ["ArrowDown", (pose) => pose.stepPitch(1)]
]);

interface OrbitDrag {
  pointerId: number;
  x: number;
  y: number;
}

export class TurntableOrbit {
  readonly #canvas: HTMLCanvasElement;
  readonly #pose: TurntablePose;
  readonly #listeners = new AbortController();
  #drag: OrbitDrag | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    pose: TurntablePose
  ) {
    this.#canvas = canvas;
    this.#pose = pose;

    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", kAriaLabel);
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";

    const { signal } = this.#listeners;
    canvas.addEventListener("pointerdown", this.#onPointerDown, { signal });
    canvas.addEventListener("pointermove", this.#onPointerMove, { signal });
    canvas.addEventListener("pointerup", this.#onPointerUp, { signal });
    canvas.addEventListener("pointercancel", this.#onPointerUp, { signal });
    canvas.addEventListener("dblclick", () => pose.reset(), { signal });
    canvas.addEventListener("keydown", this.#onKeyDown, { signal });
  }

  dispose(): void {
    this.#listeners.abort();
  }

  readonly #onPointerDown = (
    event: PointerEvent
  ): void => {
    if (event.button !== 0 || this.#drag !== null) {
      return;
    }

    this.#canvas.setPointerCapture(event.pointerId);
    this.#canvas.style.cursor = "grabbing";
    this.#drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
    this.#pose.pause();
  };

  readonly #onPointerMove = (
    event: PointerEvent
  ): void => {
    const drag = this.#drag;
    if (drag === null || drag.pointerId !== event.pointerId) {
      return;
    }

    this.#pose.turn(
      (event.clientX - drag.x) * kRadiansPerPixel,
      (event.clientY - drag.y) * kRadiansPerPixel
    );
    drag.x = event.clientX;
    drag.y = event.clientY;
  };

  readonly #onPointerUp = (
    event: PointerEvent
  ): void => {
    if (this.#drag?.pointerId !== event.pointerId) {
      return;
    }

    this.#drag = null;
    this.#canvas.style.cursor = "grab";
    if (this.#canvas.hasPointerCapture(event.pointerId)) {
      this.#canvas.releasePointerCapture(event.pointerId);
    }
  };

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    const step = kKeySteps.get(event.key);
    if (step === undefined) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    step(this.#pose);
  };
}
