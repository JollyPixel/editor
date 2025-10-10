// Import Third-party Dependencies
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import {
  BrowserDocumentAdapter,
  type DocumentAdapter,
  type CanvasAdapter
} from "../../adapters/index.js";
import type {
  InputControl
} from "../types.js";
import {
  TouchIdentifier,
  type TouchPosition
} from "./Touchpad.class.js";

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
  down: [event: MouseEvent];
  up: [event: MouseEvent];
  move: [event: MouseEvent];
  wheel: [event: WheelEvent];
};

export interface MouseOptions {
  canvas: CanvasAdapter;
  documentAdapter?: DocumentAdapter;
}

export class Mouse extends EventEmitter<
  MouseEvents
> implements InputControl {
  #canvas: CanvasAdapter;
  #documentAdapter: DocumentAdapter;

  buttons: MouseButtonState[] = [];
  buttonsDown: boolean[] = [];

  #position = { x: 0, y: 0 };
  newPosition: { x: number; y: number; } | null = null;

  #delta = { x: 0, y: 0 };
  newDelta = { x: 0, y: 0 };
  #newScrollDelta: number;

  #wasActive = false;
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

  get wasActive() {
    return this.#wasActive;
  }

  connect() {
    this.#canvas.addEventListener("mousemove", this.onMouseMove);
    this.#canvas.addEventListener("mousedown", this.onMouseDown);
    this.#canvas.addEventListener("mouseup", this.onMouseUp);
    this.#canvas.addEventListener("dblclick", this.onMouseDoubleClick);
    this.#canvas.addEventListener("wheel", this.onMouseWheel);
    this.#documentAdapter.addEventListener("pointerlockchange", this.onPointerLockChange, false);
    this.#documentAdapter.addEventListener("pointerlockerror", this.onPointerLockError, false);
  }

  disconnect() {
    this.#canvas.removeEventListener("mousemove", this.onMouseMove);
    this.#canvas.removeEventListener("mousedown", this.onMouseDown);
    this.#canvas.removeEventListener("mouseup", this.onMouseUp);
    this.#canvas.removeEventListener("dblclick", this.onMouseDoubleClick);
    this.#canvas.removeEventListener("wheel", this.onMouseWheel);
    this.#documentAdapter.removeEventListener("pointerlockchange", this.onPointerLockChange, false);
    this.#documentAdapter.removeEventListener("pointerlockerror", this.onPointerLockError, false);
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
    return this.#documentAdapter.pointerLockElement === (this.#canvas as HTMLCanvasElement);
  }

  lock() {
    if (this.#wantsPointerLock) {
      return;
    }

    this.#wantsPointerLock = true;
    this.newDelta.x = 0;
    this.newDelta.y = 0;
  }

  unlock() {
    const isLocked = this.locked;
    if (!isLocked) {
      return;
    }

    this.#wantsPointerLock = false;
    this.#wasPointerLocked = false;
    if (isLocked) {
      this.#documentAdapter.exitPointerLock();
    }
  }

  synchronizeWithTouch(
    touch: Touch,
    buttonValue?: boolean,
    position?: TouchPosition
  ) {
    if (touch.identifier !== TouchIdentifier.primary) {
      return;
    }
    if (typeof buttonValue === "boolean") {
      this.buttonsDown[MouseEventButton.left] = buttonValue;
    }
    if (position) {
      this.newPosition = position;
    }
  }

  update() {
    this.#wasActive = false;

    const isScrollUp = this.#newScrollDelta > 0;
    const isScrollDown = this.#newScrollDelta < 0;
    this.buttonsDown[MouseEventButton.scrollUp] = isScrollUp;
    this.buttonsDown[MouseEventButton.scrollDown] = isScrollDown;
    if (isScrollDown || isScrollUp) {
      this.#wasActive = true;
    }

    if (this.#newScrollDelta !== 0) {
      this.#newScrollDelta = 0;
    }

    if (this.#wantsPointerLock && this.#wasPointerLocked) {
      this.#delta.x = this.newDelta.x;
      this.#delta.y = this.newDelta.y;
      this.newDelta.x = 0;
      this.newDelta.y = 0;
    }
    else if (this.newPosition === null) {
      this.#delta.x = 0;
      this.#delta.y = 0;
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
      const isDown = this.buttonsDown[i];

      mouseButton.isDown = isDown;
      mouseButton.wasJustPressed = !wasDown && mouseButton.isDown;
      mouseButton.wasJustReleased = wasDown && !mouseButton.isDown;

      if (isDown) {
        this.#wasActive = true;
      }
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

    this.emit("move", event);
  };

  private onMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    this.#canvas.focus();
    this.buttonsDown[event.button] = true;

    if (this.#wantsPointerLock && !this.#wasPointerLocked) {
      this.#canvas.requestPointerLock();
    }
    this.emit("down", event);
  };

  private onMouseUp = (event: MouseEvent) => {
    if (this.buttonsDown[event.button]) {
      event.preventDefault();
    }
    this.buttonsDown[event.button] = false;

    if (this.#wantsPointerLock && !this.#wasPointerLocked) {
      this.#canvas.requestPointerLock();
    }
    this.emit("up", event);
  };

  private onMouseDoubleClick = (event: MouseEvent) => {
    event.preventDefault();
    this.buttons[event.button].doubleClicked = true;
  };

  private onMouseWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.#newScrollDelta = ((event as any).wheelDelta > 0 || event.detail < 0) ? 1 : -1;
    this.emit("wheel", event);

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
}
