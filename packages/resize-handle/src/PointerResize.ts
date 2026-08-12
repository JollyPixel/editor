export interface PointerCoordinate {
  x: number;
  y: number;
}

export interface PointerResizeOptions {
  handle: HTMLElement;
  /**
   * classList token applied to <html> while dragging
   */
  dragToken: string;
  canStart: () => boolean;
  onStart: (
    coordinate: PointerCoordinate
  ) => void;
  onMove: (
    coordinate: PointerCoordinate
  ) => void;
  onEnd: () => void;
}

/**
 * Owns pointer capture and temporary drag listeners for one resize handle.
 */
export class PointerResize {
  #handle: HTMLElement;
  #dragToken: string;
  #canStart: () => boolean;
  #start: (
    coordinate: PointerCoordinate
  ) => void;
  #move: (
    coordinate: PointerCoordinate
  ) => void;
  #end: () => void;
  #activePointerId: number | null = null;
  #disposed = false;

  constructor(
    options: PointerResizeOptions
  ) {
    this.#handle = options.handle;
    this.#dragToken = options.dragToken;
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

    this.#handle.setPointerCapture(
      event.pointerId
    );
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
      this.#dragToken
    );

    this.#start(
      this.#coordinate(event)
    );
  };

  #onPointerMove = (
    event: PointerEvent
  ) => {
    if (this.#activePointerId !== null) {
      this.#move(
        this.#coordinate(event)
      );
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
      this.#dragToken
    );
    this.#end();
  }

  #coordinate(
    event: PointerEvent
  ): PointerCoordinate {
    return {
      x: event.clientX,
      y: event.clientY
    };
  }
}
