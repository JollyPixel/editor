// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { CanvasAdapter } from "./../adapters/canvas.ts";
import type {
  InputControl,
  InputReader,
  Vector2Like
} from "../types.ts";
import { EdgeBuffer } from "./EdgeBuffer.ts";

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
  start: (touch: Touch, touchPosition: TouchPosition) => void;
  move: (touch: Touch, touchPosition: TouchPosition) => void;
  end: (touch: Touch) => void;
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
export class Touchpad extends Emitter<
  TouchEvents
> implements InputControl {
  static readonly MaxTouches = 10;

  static isAvailable(): boolean {
    return "ontouchstart" in document.documentElement;
  }

  #canvas: CanvasAdapter;

  #wasActive = false;
  #started = new EdgeBuffer();
  #ended = new EdgeBuffer();
  #publishedEdges = 0;
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
    this.#canvas.addEventListener("touchstart", this.#onTouchStart);
    this.#canvas.addEventListener("touchend", this.#onTouchEnd);
    this.#canvas.addEventListener("touchmove", this.#onTouchMove);
    this.#canvas.addEventListener("touchcancel", this.#onTouchCancel);
  }

  disconnect() {
    this.#canvas.removeEventListener("touchstart", this.#onTouchStart);
    this.#canvas.removeEventListener("touchend", this.#onTouchEnd);
    this.#canvas.removeEventListener("touchmove", this.#onTouchMove);
    this.#canvas.removeEventListener("touchcancel", this.#onTouchCancel);
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

  touchState(
    identifier: TouchAction
  ): TouchState {
    const finalizedIdentifier = typeof identifier === "string" ?
      TouchIdentifier[identifier] : identifier;

    if (finalizedIdentifier < 0 || finalizedIdentifier >= Touchpad.MaxTouches) {
      throw new Error(`Touch index ${finalizedIdentifier} is out of bounds.`);
    }

    return this.touches[finalizedIdentifier];
  }

  isDown(
    identifier: TouchAction
  ): boolean {
    return this.touchState(identifier).isDown;
  }

  wasStarted(
    identifier: TouchAction
  ): boolean {
    return this.touchState(identifier).wasStarted;
  }

  wasEnded(
    identifier: TouchAction
  ): boolean {
    return this.touchState(identifier).wasEnded;
  }

  viewportPosition(
    identifier: TouchAction
  ): Vector2Like {
    return this.viewportPositionTo(identifier, { x: 0, y: 0 });
  }

  viewportPositionTo<T extends Vector2Like>(
    identifier: TouchAction,
    out: T
  ): T {
    const { position } = this.touchState(identifier);
    const x = (position.x / this.#canvas.clientWidth) * 2;
    const y = (position.y / this.#canvas.clientHeight) * 2;

    out.x = x - 1;
    out.y = (y - 1) * -1;

    return out;
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
    this.#started.reset();
    this.#ended.reset();
    this.#publishedEdges = 0;
  }

  update() {
    this.sample();
    this.publish("step");
  }

  sample(): void {
    if (!this.#wasActive && !this.#anyTouchDown()) {
      return;
    }

    let active = 0;
    let started = 0;
    let ended = 0;

    for (let i = 0; i < this.touches.length; i++) {
      const touch = this.touches[i];
      const wasDown = touch.isDown;
      const isDown = this.touchesDown[i];

      touch.isDown = isDown;
      active |= Number(isDown);
      started |= Number(!wasDown && isDown) << i;
      ended |= Number(wasDown && !isDown) << i;
    }

    this.#started.push(started);
    this.#ended.push(ended);
    this.#wasActive = active !== 0;
  }

  publish(
    reader: InputReader
  ): void {
    const started = this.#started.take(reader);
    const ended = this.#ended.take(reader);
    if ((started | ended | this.#publishedEdges) === 0) {
      return;
    }

    for (let i = 0; i < this.touches.length; i++) {
      const touch = this.touches[i];
      touch.wasStarted = (started & (1 << i)) !== 0;
      touch.wasEnded = (ended & (1 << i)) !== 0;
    }
    this.#publishedEdges = started | ended;
  }

  #anyTouchDown(): boolean {
    for (let i = 0; i < this.touchesDown.length; i++) {
      if (this.touchesDown[i]) {
        return true;
      }
    }

    return false;
  }

  #onTouchStart = (event: TouchEvent) => {
    event.preventDefault();

    const rect = boundingRect(event);
    if (rect === null) {
      return;
    }

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const { identifier } = touch;
      if (identifier >= Touchpad.MaxTouches) {
        continue;
      }

      const state = this.touches[identifier];
      state.position.x = touch.clientX - rect.left;
      state.position.y = touch.clientY - rect.top;
      this.touchesDown[identifier] = true;
      this.emit("start", touch, state.position);
    }
  };

  #onTouchEnd = (event: TouchEvent) => {
    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];

      this.touchesDown[touch.identifier] = false;
      this.emit("end", touch);
    }
  };

  #onTouchCancel = (event: TouchEvent) => {
    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];

      this.touchesDown[touch.identifier] = false;
      this.emit("end", touch);
    }
  };

  #onTouchMove = (event: TouchEvent) => {
    event.preventDefault();

    const rect = boundingRect(event);
    if (rect === null) {
      return;
    }

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const { identifier } = touch;
      if (identifier >= Touchpad.MaxTouches) {
        continue;
      }

      const state = this.touches[identifier];
      state.position.x = touch.clientX - rect.left;
      state.position.y = touch.clientY - rect.top;
      this.emit("move", touch, state.position);
    }
  };
}

function boundingRect(
  event: TouchEvent
): DOMRect | null {
  if (!event.target) {
    return null;
  }

  return (event.target as Element).getBoundingClientRect();
}
