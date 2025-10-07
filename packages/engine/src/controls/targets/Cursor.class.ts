// Import Third-party Dependencies
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import {
  BrowserDocumentAdapter,
  type DocumentAdapter
} from "../../adapters/document.js";
import type {
  InputControl
} from "../types.js";

export type CursorLockState = "locked" | "unlocked";

export type CursorEvents = {
  lockStateChange: [CursorLockState];
};

export interface CursorOptions {
  canvas: HTMLCanvasElement;
  documentAdapter?: DocumentAdapter;
}

export class Cursor extends EventEmitter<
  CursorEvents
> implements InputControl {
  #canvas: HTMLCanvasElement;
  #documentAdapter: DocumentAdapter;

  #position = { x: 0, y: 0 };
  newPosition: { x: number; y: number; } | null = null;

  #delta = { x: 0, y: 0 };
  newDelta = { x: 0, y: 0 };

  #wantsPointerLock = false;
  #wasPointerLocked = false;

  constructor(
    options: CursorOptions
  ) {
    const {
      canvas,
      documentAdapter = new BrowserDocumentAdapter()
    } = options;

    super();
    this.#canvas = canvas;
    this.#documentAdapter = documentAdapter;
    this.reset();
  }

  connect() {
    this.#canvas.addEventListener("mousemove", this.onMouseMove);
    this.#documentAdapter.addEventListener("pointerlockchange", this.onPointerLockChange, false);
    this.#documentAdapter.addEventListener("pointerlockerror", this.onPointerLockError, false);
  }

  disconnect() {
    this.#canvas.removeEventListener("mousemove", this.onMouseMove);
    this.#documentAdapter.removeEventListener("pointerlockchange", this.onPointerLockChange, false);
    this.#documentAdapter.removeEventListener("pointerlockerror", this.onPointerLockError, false);
  }

  reset() {
    this.#position.x = 0;
    this.#position.y = 0;
    this.newPosition = null;

    this.#delta.x = 0;
    this.#delta.y = 0;
    this.newDelta.x = 0;
    this.newDelta.y = 0;
  }

  get position() {
    return { x: this.#position.x, y: this.#position.y };
  }

  get delta() {
    return { x: this.#delta.x, y: this.#delta.y };
  }

  get locked() {
    return document.pointerLockElement === this.#canvas;
  }

  lock() {
    this.#wantsPointerLock = true;
    // this.nextDelta.x = 0;
    // this.nextDelta.y = 0;
  }

  unlock() {
    this.#wantsPointerLock = false;
    this.#wasPointerLocked = false;
    if (this.locked) {
      document.exitPointerLock();
    }
  }

  update() {
    // if (this.#wantsPointerLock) {
    //   this.#delta.x = this.nextDelta.x;
    //   this.#delta.y = this.nextDelta.y;
    //   this.nextDelta.x = 0;
    //   this.nextDelta.y = 0;
    // }
    if (this.newPosition === null) {
      this.#delta.x = this.newDelta.x;
      this.#delta.y = this.newDelta.y;
      this.newDelta.x = 0;
      this.newDelta.y = 0;
    }
    else {
      this.#delta.x = this.newPosition.x - this.#position.x;
      this.#delta.y = this.newPosition.y - this.#position.y;

      this.#position.x = this.newPosition.x;
      this.#position.y = this.newPosition.y;
      this.newPosition = null;
    }
  }

  private onMouseMove = (event: any) => {
    event.preventDefault();

    if (this.#wantsPointerLock) {
      if (this.#wasPointerLocked) {
        const delta = { x: 0, y: 0 };
        if (event.movementX !== null) {
          delta.x = event.movementX;
          delta.y = event.movementY;
        }

        this.newDelta.x += delta.x;
        this.newDelta.y += delta.y;
      }
    }
    else {
      const rect = event.target.getBoundingClientRect();
      this.newPosition = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }
  };

  private onPointerLockChange = () => {
    const isPointerLocked = this.locked;
    if (this.#wasPointerLocked !== isPointerLocked) {
      this.emit("lockStateChange", isPointerLocked ? "locked" : "unlocked");
      this.#wasPointerLocked = isPointerLocked;
    }
  };

  private onPointerLockError = () => {
    if (this.#wasPointerLocked) {
      this.emit("lockStateChange", "unlocked");
      this.#wasPointerLocked = false;
    }
  };
}
