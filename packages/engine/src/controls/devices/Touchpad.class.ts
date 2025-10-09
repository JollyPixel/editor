// Import Third-party Dependencies
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import type { CanvasAdapter } from "../../adapters/canvas.js";
import type {
  InputControl
} from "../types.js";

export const TouchIdentifier = {
  // usually first finger/index
  primary: 0,
  // usually second finger/middle
  secondary: 1,
  // usually third finger/ring
  tertiary: 2
} as const;

export type TouchAction = number | keyof typeof TouchIdentifier;

export type TouchPosition = {
  x: number;
  y: number;
};

export type TouchEvents = {
  start: [Touch, TouchPosition];
  move: [Touch, TouchPosition];
  end: [Touch];
};

export interface TouchState {
  isDown: boolean;
  wasStarted: boolean;
  wasEnded: boolean;
  position: { x: number; y: number; };
}

export interface TouchpadOptions {
  canvas: CanvasAdapter;
}

/**
 * Touchpad input handler supporting multi-touch gestures.
 *
 * Touch identifiers are assigned by the browser sequentially as fingers touch the screen.
 * The first touch is typically identifier 0, second is 1, etc.
 * Identifiers may be reused after a touch ends.
 *
 * @see https://www.w3.org/TR/touch-events/
 * @see https://docs.google.com/document/d/12-HPlSIF7-ISY8TQHtuQ3IqDi-isZVI0Yzv5zwl90VU/edit?tab=t.0
 */
export class Touchpad extends EventEmitter<
  TouchEvents
> implements InputControl {
  static readonly MaxTouches = 10;

  #canvas: CanvasAdapter;

  #wasActive = false;
  touches: TouchState[] = [];
  touchesDown: boolean[] = [];

  constructor(
    options: TouchpadOptions
  ) {
    super();
    const {
      canvas
    } = options;

    this.#canvas = canvas;
    this.reset();
  }

  get wasActive() {
    return this.#wasActive;
  }

  connect() {
    this.#canvas.addEventListener("touchstart", this.onTouchStart);
    this.#canvas.addEventListener("touchend", this.onTouchEnd);
    this.#canvas.addEventListener("touchmove", this.onTouchMove);
    this.#canvas.addEventListener("touchcancel", this.onTouchCancel);
  }

  disconnect() {
    this.#canvas.removeEventListener("touchstart", this.onTouchStart);
    this.#canvas.removeEventListener("touchend", this.onTouchEnd);
    this.#canvas.removeEventListener("touchmove", this.onTouchMove);
    this.#canvas.removeEventListener("touchcancel", this.onTouchCancel);
  }

  get isOneFingerGesture(): boolean {
    return this.touchesDown[TouchIdentifier.primary];
  }

  get isTwoFingerGesture(): boolean {
    return (
      this.touchesDown[TouchIdentifier.primary] &&
      this.touchesDown[TouchIdentifier.secondary]
    );
  }

  get isThreeFingerGesture(): boolean {
    return (
      this.touchesDown[TouchIdentifier.primary] &&
      this.touchesDown[TouchIdentifier.secondary] &&
      this.touchesDown[TouchIdentifier.tertiary]
    );
  }

  getTouchState(
    identifier: TouchAction
  ): TouchState {
    const finalizedIdentifier = typeof identifier === "string" ?
      TouchIdentifier[identifier] : identifier;

    if (finalizedIdentifier < 0 || finalizedIdentifier >= Touchpad.MaxTouches) {
      throw new Error(`Touch index ${finalizedIdentifier} is out of bounds.`);
    }

    return this.touches[finalizedIdentifier];
  }

  reset() {
    for (let i = 0; i < Touchpad.MaxTouches; i++) {
      this.touches[i] = {
        isDown: false,
        wasStarted: false,
        wasEnded: false,
        position: {
          x: 0,
          y: 0
        }
      };
      this.touchesDown[i] = false;
    }
  }

  update() {
    this.#wasActive = false;

    for (let i = 0; i < this.touches.length; i++) {
      const touch = this.touches[i];
      const wasDown = touch.isDown;
      const isDown = this.touchesDown[i];

      touch.isDown = isDown;
      touch.wasStarted = !wasDown && touch.isDown;
      touch.wasEnded = wasDown && !touch.isDown;

      if (isDown) {
        this.#wasActive = true;
      }
    }
  }

  private onTouchStart = (event: TouchEvent) => {
    event.preventDefault();

    for (const { touch, position } of extractTouchPositions(event)) {
      const { identifier } = touch;

      this.touches[identifier].position.x = position.x;
      this.touches[identifier].position.y = position.y;
      this.touchesDown[identifier] = true;
      this.emit("start", touch, position);
    }
  };

  private onTouchEnd = (event: TouchEvent) => {
    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];

      this.touchesDown[touch.identifier] = false;
      this.emit("end", touch);
    }
  };

  private onTouchCancel = (event: TouchEvent) => {
    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];

      this.touchesDown[touch.identifier] = false;
      this.emit("end", touch);
    }
  };

  private onTouchMove = (event: TouchEvent) => {
    event.preventDefault();

    for (const { touch, position } of extractTouchPositions(event)) {
      const { identifier } = touch;

      this.touches[identifier].position.x = position.x;
      this.touches[identifier].position.y = position.y;
      this.emit("move", touch, position);
    }
  };
}

function* extractTouchPositions(
  event: TouchEvent
): IterableIterator<{
    touch: Touch;
    position: TouchPosition;
  }> {
  if (!event.target) {
    return;
  }

  const rect = (event.target as Element).getBoundingClientRect();

  for (let i = 0; i < event.changedTouches.length; i++) {
    const touch = event.changedTouches[i];
    if (touch.identifier >= Touchpad.MaxTouches) {
      continue;
    }

    const position = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };

    yield { touch, position };
  }
}
