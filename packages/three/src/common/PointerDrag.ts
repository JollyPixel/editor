// Import Third-party Dependencies
import type * as THREE from "three";

export interface PointerDragHandlers {
  /**
   * Any pointer press on the element; call `begin` to claim it as a drag.
   */
  press: (event: PointerEvent) => void;
  /**
   * Pointer motion while no drag is running; returns whether the
   * pointer is over something a press would grab.
   */
  hover: (event: PointerEvent) => boolean;
  /**
   * Motion of the dragging pointer.
   */
  drag: (event: PointerEvent) => void;
  /**
   * The drag stopped, whether released, cancelled or ended by `end`.
   */
  release: () => void;
}

type DragCursor = "grab" | "grabbing";

export class PointerDrag {
  #handlers: PointerDragHandlers;
  #element: HTMLElement | null = null;
  #pointerId: number | null = null;
  #cursor: DragCursor | null = null;
  #hostCursor = "";

  constructor(
    handlers: PointerDragHandlers
  ) {
    this.#handlers = handlers;
  }

  get element(): HTMLElement | null {
    return this.#element;
  }

  get active(): boolean {
    return this.#pointerId !== null;
  }

  connect(
    element: HTMLElement
  ): void {
    if (element === this.#element) {
      return;
    }

    this.disconnect();
    this.#element = element;
    element.addEventListener("pointerdown", this.#onPointerDown);
    element.addEventListener("pointermove", this.#onPointerMove);
  }

  disconnect(): void {
    const element = this.#element;
    if (element === null) {
      return;
    }

    this.end();
    this.#showCursor(null);
    element.removeEventListener("pointerdown", this.#onPointerDown);
    element.removeEventListener("pointermove", this.#onPointerMove);
    this.#element = null;
  }

  begin(
    event: PointerEvent
  ): void {
    const element = this.#element;
    if (element === null || this.#pointerId !== null) {
      return;
    }

    this.#pointerId = event.pointerId;
    element.addEventListener("pointerup", this.#onPointerUp);
    element.addEventListener("pointercancel", this.#onPointerUp);
    element.setPointerCapture?.(event.pointerId);
    this.#showCursor("grabbing");
  }

  end(): void {
    const element = this.#element;
    const pointerId = this.#pointerId;
    if (element === null || pointerId === null) {
      return;
    }

    this.#pointerId = null;
    element.removeEventListener("pointerup", this.#onPointerUp);
    element.removeEventListener("pointercancel", this.#onPointerUp);
    if (element.hasPointerCapture?.(pointerId)) {
      element.releasePointerCapture(pointerId);
    }

    this.#showCursor(null);
    this.#handlers.release();
  }

  toNdc(
    event: PointerEvent,
    target: THREE.Vector2
  ): boolean {
    const element = this.#element;
    if (element === null) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    target.set(
      (((event.clientX - rect.left) / rect.width) * 2) - 1,
      (-((event.clientY - rect.top) / rect.height) * 2) + 1
    );

    return true;
  }

  readonly #onPointerDown = (
    event: PointerEvent
  ): void => {
    this.#handlers.press(event);
  };

  readonly #onPointerMove = (
    event: PointerEvent
  ): void => {
    if (this.#pointerId === null) {
      this.#hover(event);
    }
    else if (event.pointerId === this.#pointerId) {
      this.#handlers.drag(event);
    }
  };

  readonly #onPointerUp = (
    event: PointerEvent
  ): void => {
    if (event.pointerId !== this.#pointerId) {
      return;
    }

    this.end();
    if (event.type === "pointerup") {
      this.#hover(event);
    }
  };

  #hover(
    event: PointerEvent
  ): void {
    this.#showCursor(this.#handlers.hover(event) ? "grab" : null);
  }

  #showCursor(
    cursor: DragCursor | null
  ): void {
    const element = this.#element;
    if (element === null || cursor === this.#cursor) {
      return;
    }

    if (this.#cursor === null) {
      this.#hostCursor = element.style.cursor;
    }
    this.#cursor = cursor;
    element.style.cursor = cursor ?? this.#hostCursor;
  }
}
