// Import Internal Dependencies
import type {
  ResizeDirectionDefinition
} from "./ResizeDirection.ts";

export interface PointerResizeOptions {
  handle: HTMLElement;
  definition: ResizeDirectionDefinition;
  canStart: () => boolean;
  onStart: (
    coordinate: number
  ) => void;
  onMove: (
    coordinate: number
  ) => void;
  onEnd: () => void;
}

/**
 * Owns pointer capture and temporary drag listeners for one resize handle.
 */
export class PointerResize {
  #handle: HTMLElement;
  #definition: ResizeDirectionDefinition;
  #canStart: () => boolean;
  #start: (coordinate: number) => void;
  #move: (coordinate: number) => void;
  #end: () => void;
  #activePointerId: number | null = null;
  #disposed = false;

  constructor(
    options: PointerResizeOptions
  ) {
    this.#handle = options.handle;
    this.#definition = options.definition;
    this.#canStart = options.canStart;
    this.#start = options.onStart;
    this.#move = options.onMove;
    this.#end = options.onEnd;

    this.#handle.addEventListener(
      "pointerdown",
      this.#onPointerDown
    );
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#finish();
    this.#handle.removeEventListener(
      "pointerdown",
      this.#onPointerDown
    );
  }

  #onPointerDown = (
    event: PointerEvent
  ) => {
    if (
      event.button !== 0 ||
      this.#activePointerId !== null ||
      !this.#canStart()
    ) {
      return;
    }

    event.preventDefault();
    this.#activePointerId = event.pointerId;

    this.#handle.setPointerCapture(event.pointerId);
    this.#handle.addEventListener(
      "pointermove",
      this.#onPointerMove
    );
    this.#handle.addEventListener(
      "pointerup",
      this.#onPointerEnd
    );
    this.#handle.addEventListener(
      "pointercancel",
      this.#onPointerEnd
    );
    document.documentElement.classList.add(
      "handle-dragging",
      this.#definition.orientation
    );

    this.#start(this.#coordinate(event));
  };

  #onPointerMove = (
    event: PointerEvent
  ) => {
    if (this.#activePointerId !== null) {
      this.#move(this.#coordinate(event));
    }
  };

  #onPointerEnd = () => {
    this.#finish();
  };

  #finish(): void {
    if (this.#activePointerId === null) {
      return;
    }

    const pointerId = this.#activePointerId;
    this.#activePointerId = null;
    try {
      this.#handle.releasePointerCapture(pointerId);
    }
    catch {
      // Pointer cancellation may release capture before the handler runs.
    }

    this.#handle.removeEventListener(
      "pointermove",
      this.#onPointerMove
    );
    this.#handle.removeEventListener(
      "pointerup",
      this.#onPointerEnd
    );
    this.#handle.removeEventListener(
      "pointercancel",
      this.#onPointerEnd
    );
    document.documentElement.classList.remove(
      "handle-dragging",
      this.#definition.orientation
    );
    this.#end();
  }

  #coordinate(
    event: PointerEvent
  ): number {
    return event[this.#definition.coordinate];
  }
}
