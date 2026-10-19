// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { CanvasAdapter } from "../adapters/canvas.ts";
import type {
  InputControl,
  InputReader,
  Vector2Like
} from "../types.ts";
import { ControlBank } from "./ControlBank.ts";

export const TouchIdentifier = {
  primary: 0,
  secondary: 1,
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
  position: TouchPosition;
}

export interface TouchpadOptions {
  canvas: CanvasAdapter;
}

export class Touchpad extends Emitter<
  TouchEvents
> implements InputControl {
  static readonly MaxTouches = 10;

  static isAvailable(): boolean {
    return "ontouchstart" in document.documentElement;
  }

  #canvas: CanvasAdapter;

  #touches = new ControlBank<number>();
  #slots = new Map<number, number>();
  #positions: TouchPosition[] = [];

  constructor(
    options: TouchpadOptions
  ) {
    super();
    const {
      canvas
    } = options;

    this.#canvas = canvas;
    for (let slot = 0; slot < Touchpad.MaxTouches; slot++) {
      this.#positions.push({
        x: 0,
        y: 0
      });
    }
  }

  get wasActive() {
    return this.#touches.active;
  }

  connect() {
    this.#canvas.addEventListener("touchstart", this.#onTouchStart);
    this.#canvas.addEventListener("touchend", this.#onTouchEnd);
    this.#canvas.addEventListener("touchmove", this.#onTouchMove);
    this.#canvas.addEventListener("touchcancel", this.#onTouchEnd);
  }

  disconnect() {
    this.#canvas.removeEventListener("touchstart", this.#onTouchStart);
    this.#canvas.removeEventListener("touchend", this.#onTouchEnd);
    this.#canvas.removeEventListener("touchmove", this.#onTouchMove);
    this.#canvas.removeEventListener("touchcancel", this.#onTouchEnd);
  }

  get isOneFingerGesture(): boolean {
    return this.#touches.isDown(
      TouchIdentifier.primary
    );
  }

  get isTwoFingerGesture(): boolean {
    return this.isOneFingerGesture &&
      this.#touches.isDown(
        TouchIdentifier.secondary
      );
  }

  get isThreeFingerGesture(): boolean {
    return this.isTwoFingerGesture && this.#touches.isDown(
      TouchIdentifier.tertiary
    );
  }

  touchState(
    identifier: TouchAction
  ): TouchState {
    const slot = Touchpad.#touchSlot(identifier);

    return {
      isDown: this.#touches.isDown(slot),
      wasStarted: this.#touches.wasPressed(slot),
      wasEnded: this.#touches.wasReleased(slot),
      position: {
        ...this.#positions[slot]
      }
    };
  }

  isDown(
    identifier: TouchAction
  ): boolean {
    return this.#touches.isDown(
      Touchpad.#touchSlot(identifier)
    );
  }

  wasStarted(
    identifier: TouchAction
  ): boolean {
    return this.#touches.wasPressed(
      Touchpad.#touchSlot(identifier)
    );
  }

  wasEnded(
    identifier: TouchAction
  ): boolean {
    return this.#touches.wasReleased(
      Touchpad.#touchSlot(identifier)
    );
  }

  viewportPosition(
    identifier: TouchAction
  ): Vector2Like {
    return this.viewportPositionTo(
      identifier,
      { x: 0, y: 0 }
    );
  }

  viewportPositionTo<T extends Vector2Like>(
    identifier: TouchAction,
    out: T
  ): T {
    const position = this.#positions[Touchpad.#touchSlot(identifier)];
    const x = (position.x / this.#canvas.clientWidth) * 2;
    const y = (position.y / this.#canvas.clientHeight) * 2;

    out.x = x - 1;
    out.y = (y - 1) * -1;

    return out;
  }

  reset() {
    this.#touches.reset();
    this.#slots.clear();
    for (const position of this.#positions) {
      position.x = 0;
      position.y = 0;
    }
  }

  update() {
    this.sample();
    this.publish("step");
  }

  sample(): void {
    this.#touches.sample();
  }

  publish(
    reader: InputReader
  ): void {
    this.#touches.publish(reader);
  }

  #claimSlot(
    identifier: number
  ): number | null {
    const claimed = this.#slots.get(identifier);
    if (claimed !== undefined) {
      return claimed;
    }

    for (let slot = 0; slot < Touchpad.MaxTouches; slot++) {
      if (!this.#touches.isDown(slot)) {
        this.#slots.set(identifier, slot);

        return slot;
      }
    }

    return null;
  }

  #onTouchStart = (event: TouchEvent) => {
    event.preventDefault();

    const rect = this.#canvas.getBoundingClientRect?.();
    if (!rect) {
      return;
    }

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const slot = this.#claimSlot(touch.identifier);
      if (slot === null) {
        continue;
      }

      const position = this.#positions[slot];
      position.x = touch.clientX - rect.left;
      position.y = touch.clientY - rect.top;
      this.#touches.press(slot);
      this.emit("start", touch, position);
    }
  };

  #onTouchEnd = (event: TouchEvent) => {
    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const slot = this.#slots.get(touch.identifier);
      if (slot === undefined) {
        continue;
      }

      this.#slots.delete(touch.identifier);
      this.#touches.release(slot);
      this.emit("end", touch);
    }
  };

  #onTouchMove = (event: TouchEvent) => {
    event.preventDefault();

    const rect = this.#canvas.getBoundingClientRect?.();
    if (!rect) {
      return;
    }

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const slot = this.#slots.get(touch.identifier);
      if (slot === undefined) {
        continue;
      }

      const position = this.#positions[slot];
      position.x = touch.clientX - rect.left;
      position.y = touch.clientY - rect.top;
      this.emit("move", touch, position);
    }
  };

  static #touchSlot(
    identifier: TouchAction
  ): number {
    const slot = typeof identifier === "string" ?
      TouchIdentifier[identifier] :
      identifier;

    if (slot < 0 || slot >= Touchpad.MaxTouches) {
      throw new Error(`Touch index ${slot} is out of bounds.`);
    }

    return slot;
  }
}
