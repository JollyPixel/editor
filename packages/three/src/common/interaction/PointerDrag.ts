// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import { clientToNdc } from "../screen/clientToNdc.ts";

// CONSTANTS
const kCancelKey = "Escape";

export interface PointerDragRelease {
  event: PointerEvent | null;
  cancelled: boolean;
}

export interface PointerDragHandlers<TSession> {
  enabled: () => boolean;
  press: (event: PointerEvent) => boolean;
  hover: (event: PointerEvent) => boolean;
  drag: (session: TSession, event: PointerEvent) => void;
  cancel?: (session: TSession) => void;
  release: (session: TSession, release: PointerDragRelease) => void;
}

type DragCursor = "grab" | "grabbing";

export class PointerDrag<TSession> {
  #handlers: PointerDragHandlers<TSession>;
  #element: HTMLElement | null = null;
  #session: TSession | null = null;
  #pointerId: number | null = null;
  #keyTarget: Document | null = null;
  #cursor: DragCursor | null = null;
  #hostCursor = "";

  constructor(
    handlers: PointerDragHandlers<TSession>
  ) {
    this.#handlers = handlers;
  }

  get element(): HTMLElement | null {
    return this.#element;
  }

  get session(): TSession | null {
    return this.#session;
  }

  get active(): boolean {
    return this.#session !== null;
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

  claim(
    event: PointerEvent
  ): boolean {
    return this.#element !== null &&
      this.#session === null &&
      event.button === 0 &&
      this.#handlers.enabled() &&
      this.#handlers.press(event);
  }

  begin(
    event: PointerEvent,
    session: TSession
  ): void {
    const element = this.#element;
    if (element === null || this.#session !== null) {
      return;
    }

    this.#session = session;
    this.#pointerId = event.pointerId;
    element.addEventListener("pointerup", this.#onPointerUp);
    element.addEventListener("pointercancel", this.#onPointerUp);
    element.setPointerCapture?.(event.pointerId);
    this.#keyTarget = element.ownerDocument;
    this.#keyTarget.addEventListener("keydown", this.#onKeyDown);
    this.#showCursor("grabbing");
  }

  cancel(): void {
    const session = this.#session;
    if (session === null) {
      return;
    }

    this.#handlers.cancel?.(session);
    this.#finish(null, true);
  }

  end(): void {
    this.#finish(null, false);
  }

  toNdc(
    event: PointerEvent,
    target: THREE.Vector2
  ): boolean {
    const element = this.#element;

    return element !== null &&
      clientToNdc(element, event.clientX, event.clientY, target) !== null;
  }

  readonly #onPointerDown = (
    event: PointerEvent
  ): void => {
    this.claim(event);
  };

  readonly #onPointerMove = (
    event: PointerEvent
  ): void => {
    const session = this.#session;
    if (session === null) {
      this.#hover(event);
    }
    else if (event.pointerId === this.#pointerId && this.#handlers.enabled()) {
      this.#handlers.drag(session, event);
    }
  };

  readonly #onPointerUp = (
    event: PointerEvent
  ): void => {
    if (event.pointerId !== this.#pointerId) {
      return;
    }

    const released = event.type === "pointerup";
    this.#finish(released ? event : null, false);
    if (released) {
      this.#hover(event);
    }
  };

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (event.key === kCancelKey) {
      this.cancel();
    }
  };

  #finish(
    event: PointerEvent | null,
    cancelled: boolean
  ): void {
    const element = this.#element;
    const session = this.#session;
    const pointerId = this.#pointerId;
    if (element === null || session === null || pointerId === null) {
      return;
    }

    this.#session = null;
    this.#pointerId = null;
    element.removeEventListener("pointerup", this.#onPointerUp);
    element.removeEventListener("pointercancel", this.#onPointerUp);
    this.#keyTarget?.removeEventListener("keydown", this.#onKeyDown);
    this.#keyTarget = null;
    if (element.hasPointerCapture?.(pointerId)) {
      element.releasePointerCapture(pointerId);
    }

    this.#showCursor(null);
    this.#handlers.release(session, { event, cancelled });
  }

  #hover(
    event: PointerEvent
  ): void {
    const grabbable = this.#handlers.enabled() && this.#handlers.hover(event);
    this.#showCursor(grabbable ? "grab" : null);
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
