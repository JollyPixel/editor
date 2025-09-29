// Import Internal Dependencies
import { Mouse } from "./Mouse.class.js";
import type {
  InputControl
} from "../types.js";

export interface TouchState {
  isDown: boolean;
  wasStarted: boolean;
  wasEnded: boolean;
  position: { x: number; y: number; };
}

export interface TouchpadOptions {
  canvas: HTMLCanvasElement;
  mouse: Mouse;
}

export class Touchpad implements InputControl {
  static readonly MaxTouches = 10;

  #canvas: HTMLCanvasElement;
  #mouse: Mouse;

  touches: TouchState[] = [];
  touchesDown: boolean[] = [];

  constructor(
    options: TouchpadOptions
  ) {
    const {
      canvas,
      mouse
    } = options;

    this.#canvas = canvas;
    this.#mouse = mouse;
    this.reset();
  }

  connect() {
    this.#canvas.addEventListener("touchstart", this.onTouchStart);
    this.#canvas.addEventListener("touchend", this.onTouchEnd);
    this.#canvas.addEventListener("touchmove", this.onTouchMove);
  }

  disconnect() {
    this.#canvas.removeEventListener("touchstart", this.onTouchStart);
    this.#canvas.removeEventListener("touchend", this.onTouchEnd);
    this.#canvas.removeEventListener("touchmove", this.onTouchMove);
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

  private onTouchStart = (event: TouchEvent) => {
    event.preventDefault();
    if (!event.target) {
      return;
    }

    const rect = (event.target as Element).getBoundingClientRect();
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.touches[touch.identifier].position.x = touch.clientX - rect.left;
      this.touches[touch.identifier].position.y = touch.clientY - rect.top;

      this.touchesDown[touch.identifier] = true;

      if (touch.identifier === 0) {
        this.#mouse.newPosition = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top
        };
        this.#mouse.buttonsDown[0] = true;
      }
    }
  };

  private onTouchEnd = (event: TouchEvent) => {
    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.touchesDown[touch.identifier] = false;
      if (touch.identifier === 0) {
        this.#mouse.buttonsDown[0] = false;
      }
    }
  };

  private onTouchMove = (event: TouchEvent) => {
    event.preventDefault();
    if (!event.target) {
      return;
    }

    const rect = (event.target as Element).getBoundingClientRect();
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.touches[touch.identifier].position.x = touch.clientX - rect.left;
      this.touches[touch.identifier].position.y = touch.clientY - rect.top;

      if (touch.identifier === 0) {
        this.#mouse.newPosition = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top
        };
      }
    }
  };

  update() {
    for (let i = 0; i < this.touches.length; i++) {
      const touch = this.touches[i];
      const wasDown = touch.isDown;
      touch.isDown = this.touchesDown[i];

      touch.wasStarted = !wasDown && touch.isDown;
      touch.wasEnded = wasDown && !touch.isDown;
    }
  }
}
