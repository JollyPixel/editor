// Import Third-party Dependencies
import type * as THREE from "three";

export interface PointerDragHandlers {
  /**
   * Any pointer press on the element; call `begin` to claim it as a drag.
   */
  press: (event: PointerEvent) => void;
  /**
   * Pointer motion while no drag is running.
   */
  hover: (event: PointerEvent) => void;
  /**
   * Motion of the dragging pointer.
   */
  drag: (event: PointerEvent) => void;
  /**
   * The drag stopped, whether released, cancelled or ended by `end`.
   */
  release: () => void;
}

export class PointerDrag {
  #handlers: PointerDragHandlers;
  #element: HTMLElement | null = null;
  #pointerId: number | null = null;

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
      this.#handlers.hover(event);
    }
    else if (event.pointerId === this.#pointerId) {
      this.#handlers.drag(event);
    }
  };

  readonly #onPointerUp = (
    event: PointerEvent
  ): void => {
    if (event.pointerId === this.#pointerId) {
      this.end();
    }
  };
}
