// Import Third-party Dependencies
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import {
  BrowserDocumentAdapter,
  type DocumentAdapter
} from "../../adapters/document.js";
import { HookDb } from "../HookDb.js";
import type {
  InputControl
} from "../types.js";

export interface MouseButtonState {
  isDown: boolean;
  doubleClicked: boolean;
  wasJustPressed: boolean;
  wasJustReleased: boolean;
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
 */
export const MouseEventButton = {
  left: 0,
  middle: 1,
  right: 2,
  back: 3,
  forward: 4,
  scrollUp: 5,
  scrollDown: 6
} as const;
export type MouseAction = keyof typeof MouseEventButton;

export type MouseLockState = "locked" | "unlocked";

export type MouseEvents = {
  lockStateChange: [MouseLockState];
};

export type MouseHooks = {
  down: [event: MouseEvent];
  up: [event: MouseEvent];
  move: [event: MouseEvent];
  wheel: [event: WheelEvent];
};

export interface MouseOptions {
  canvas: HTMLCanvasElement;
  mouseDownCallback?: (event: MouseEvent) => void;
  mouseUpCallback?: (event: MouseEvent) => void;
  documentAdapter?: DocumentAdapter;
}

export class Mouse extends EventEmitter<
  MouseEvents
> implements InputControl {
  #canvas: HTMLCanvasElement;
  #documentAdapter: DocumentAdapter;

  hooks = new HookDb<MouseHooks>();

  buttons: MouseButtonState[] = [];
  buttonsDown: boolean[] = [];

  #position = { x: 0, y: 0 };
  newPosition: { x: number; y: number; } | null = null;

  #delta = { x: 0, y: 0 };
  newDelta = { x: 0, y: 0 };
  #newScrollDelta: number;

  #wantsPointerLock = false;
  #wasPointerLocked = false;

  constructor(
    options: MouseOptions
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
    this.#canvas.addEventListener("mousedown", this.onMouseDown);
    this.#canvas.addEventListener("dblclick", this.onMouseDoubleClick);
    this.#canvas.addEventListener("wheel", this.onMouseWheel);
    this.#canvas.addEventListener("contextmenu", this.onContextMenu);
    this.#documentAdapter.addEventListener("pointerlockchange", this.onPointerLockChange, false);
    this.#documentAdapter.addEventListener("pointerlockerror", this.onPointerLockError, false);
    this.#documentAdapter.addEventListener("mouseup", this.onMouseUp);
  }

  disconnect() {
    this.#canvas.removeEventListener("mousemove", this.onMouseMove);
    this.#canvas.removeEventListener("mousedown", this.onMouseDown);
    this.#canvas.removeEventListener("dblclick", this.onMouseDoubleClick);
    this.#canvas.removeEventListener("wheel", this.onMouseWheel);
    this.#canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.#documentAdapter.removeEventListener("pointerlockchange", this.onPointerLockChange, false);
    this.#documentAdapter.removeEventListener("pointerlockerror", this.onPointerLockError, false);
    this.#documentAdapter.removeEventListener("mouseup", this.onMouseUp);
  }

  reset() {
    this.#newScrollDelta = 0;
    for (let i = 0; i <= 6; i++) {
      this.buttons[i] = {
        isDown: false,
        doubleClicked: false,
        wasJustPressed: false,
        wasJustReleased: false
      };
      this.buttonsDown[i] = false;
    }

    this.#position.x = 0;
    this.#position.y = 0;
    this.newPosition = null;

    this.#delta.x = 0;
    this.#delta.y = 0;
    this.newDelta.x = 0;
    this.newDelta.y = 0;
  }

  get scrollUp() {
    return this.buttonsDown[MouseEventButton.scrollUp];
  }

  get scrollDown() {
    return this.buttonsDown[MouseEventButton.scrollDown];
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
    this.buttonsDown[MouseEventButton.scrollUp] = this.#newScrollDelta > 0;
    this.buttonsDown[MouseEventButton.scrollDown] = this.#newScrollDelta < 0;
    if (this.#newScrollDelta !== 0) {
      this.#newScrollDelta = 0;
    }

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

    for (let i = 0; i < this.buttons.length; i++) {
      const mouseButton = this.buttons[i];
      const wasDown = mouseButton.isDown;

      mouseButton.isDown = this.buttonsDown[i];
      mouseButton.wasJustPressed = !wasDown && mouseButton.isDown;
      mouseButton.wasJustReleased = wasDown && !mouseButton.isDown;
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

    this.hooks.emit("move", event);
  };

  private onMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    this.#canvas.focus();
    this.buttonsDown[event.button] = true;

    if (this.#wantsPointerLock && !this.#wasPointerLocked) {
      this.#canvas.requestPointerLock();
    }
    this.hooks.emit("down", event);
  };

  private onMouseUp = (event: MouseEvent) => {
    if (this.buttonsDown[event.button]) {
      event.preventDefault();
    }
    this.buttonsDown[event.button] = false;

    if (this.#wantsPointerLock && !this.#wasPointerLocked) {
      this.#canvas.requestPointerLock();
    }
    this.hooks.emit("up", event);
  };

  private onMouseDoubleClick = (event: MouseEvent) => {
    event.preventDefault();
    this.buttons[event.button].doubleClicked = true;
  };

  private onMouseWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.#newScrollDelta = ((event as any).wheelDelta > 0 || event.detail < 0) ? 1 : -1;
    this.hooks.emit("wheel", event);

    return false;
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

  private onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };
}
