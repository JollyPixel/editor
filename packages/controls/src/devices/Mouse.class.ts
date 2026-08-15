// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  BrowserDocumentAdapter,
  type DocumentAdapter,
  type CanvasAdapter
} from "./../adapters/index.ts";
import type {
  InputControl,
  InputCustomAction,
  Vector2Like
} from "../types.ts";
import { InputActionQuery } from "../InputActionQuery.ts";
import {
  TouchIdentifier,
  type TouchPosition
} from "./Touchpad.class.ts";

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
export type InputMouseAction = number | MouseAction | InputCustomAction;

export type MouseLockState = "locked" | "unlocked";

export type MouseEvents = {
  lockStateChange: (state: MouseLockState) => void;
  down: (event: MouseEvent) => void;
  up: (event: MouseEvent) => void;
  move: (event: MouseEvent) => void;
  wheel: (event: MouseEvent) => void;
};

export interface MouseOptions {
  canvas: CanvasAdapter;
  documentAdapter?: DocumentAdapter;
}

export class Mouse extends Emitter<
  MouseEvents
> implements InputControl {
  /**
   * @see https://github.com/w3c/uievents/issues/181
   */
  static getWheelDelta(
    event: WheelEvent
  ): [number, number] {
    const isApple = /^Mac|iPhone|iPod|iPad/i.test(navigator.platform);

    if (isApple) {
      // Note that deltaMode MUST be accessed BEFORE delta* in order to get
      // non-pixel values in Firefox.
      // See https://github.com/w3c/uievents/issues/181

      switch (event.deltaMode) {
        case event.DOM_DELTA_LINE:
        case event.DOM_DELTA_PAGE:
          // Discard the delta value, just take the sign
          return [
            Math.sign(event.deltaX),
            Math.sign(-event.deltaY)
          ];
        case event.DOM_DELTA_PIXEL:
        default:
          return [
            event.deltaX / 120,
            -event.deltaY / 120
          ];
      }
    }
    else {
      return [
        -(event as any).wheelDeltaX / 120,
        (event as any).wheelDeltaY / 120
      ];
    }
  }

  #canvas: CanvasAdapter;
  #documentAdapter: DocumentAdapter;

  buttons: MouseButtonState[] = [];
  buttonsDown: boolean[] = [];

  #position = {
    x: 0,
    y: 0
  };
  newPosition: { x: number; y: number; } | null = null;

  #delta = {
    x: 0,
    y: 0
  };
  newDelta = {
    x: 0,
    y: 0
  };
  #scrollDelta = {
    x: 0,
    y: 0
  };

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
    this.#canvas.addEventListener(
      "mousemove",
      this.#onMouseMove
    );
    this.#canvas.addEventListener(
      "mousedown",
      this.#onMouseDown
    );
    this.#canvas.addEventListener(
      "mouseup",
      this.#onMouseUp
    );
    this.#canvas.addEventListener(
      "dblclick",
      this.#onMouseDoubleClick
    );
    this.#canvas.addEventListener(
      "wheel",
      this.#onMouseWheel
    );
    this.#documentAdapter.addEventListener(
      "pointerlockchange",
      this.#onPointerLockChange,
      false
    );
    this.#documentAdapter.addEventListener(
      "pointerlockerror",
      this.#onPointerLockError,
      false
    );
  }

  disconnect() {
    this.#canvas.removeEventListener(
      "mousemove",
      this.#onMouseMove
    );
    this.#canvas.removeEventListener(
      "mousedown",
      this.#onMouseDown
    );
    this.#canvas.removeEventListener(
      "mouseup",
      this.#onMouseUp
    );
    this.#canvas.removeEventListener(
      "dblclick",
      this.#onMouseDoubleClick
    );
    this.#canvas.removeEventListener(
      "wheel",
      this.#onMouseWheel
    );
    this.#documentAdapter.removeEventListener(
      "pointerlockchange",
      this.#onPointerLockChange,
      false
    );
    this.#documentAdapter.removeEventListener(
      "pointerlockerror",
      this.#onPointerLockError,
      false
    );
  }

  reset() {
    this.#scrollDelta.x = 0;
    this.#scrollDelta.y = 0;
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
    return {
      x: this.#position.x,
      y: this.#position.y
    };
  }

  get delta() {
    return {
      x: this.#delta.x,
      y: this.#delta.y
    };
  }

  get locked() {
    return this.#documentAdapter.pointerLockElement === this.#canvas;
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

  isVisible(): boolean {
    return this.#canvas.style.cursor !== "none";
  }

  setVisible(
    visible: boolean
  ): void {
    this.#canvas.style.cursor = visible ? "auto" : "none";
  }

  /**
   * Canvas-relative `position`, normalized to `[-1, 1]` on both axes with Y
   * flipped (game/NDC convention: up is positive), rather than the raw
   * top-left-origin pixel space `position` is in.
   */
  getViewportPosition(): Vector2Like {
    const position = this.position;
    const x = (position.x / this.#canvas.clientWidth) * 2;
    const y = (position.y / this.#canvas.clientHeight) * 2;

    return {
      x: x - 1,
      y: (y - 1) * -1
    };
  }

  /** `getViewportPosition()` scaled by half the canvas size, i.e. centered pixel coordinates. */
  getWorldPosition(): Vector2Like {
    const normalized = this.getViewportPosition();

    return {
      x: normalized.x * (this.#canvas.clientWidth / 2),
      y: normalized.y * (this.#canvas.clientHeight / 2)
    };
  }

  /** Like `delta`, but Y-flipped and optionally normalized against half the canvas size. */
  getViewportDelta(
    normalizeWithSize = false
  ): Vector2Like {
    const delta = this.delta;

    if (normalizeWithSize) {
      return {
        x: delta.x / (this.#canvas.clientWidth / 2),
        y: -delta.y / (this.#canvas.clientHeight / 2)
      };
    }

    return {
      x: delta.x,
      y: -delta.y
    };
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

    const isScrollUp = this.#scrollDelta.y > 0;
    const isScrollDown = this.#scrollDelta.y < 0;
    this.buttonsDown[MouseEventButton.scrollUp] = isScrollUp;
    this.buttonsDown[MouseEventButton.scrollDown] = isScrollDown;
    if (isScrollDown || isScrollUp) {
      this.#wasActive = true;
    }

    if (this.#scrollDelta.x !== 0) {
      this.#scrollDelta.x = 0;
    }
    if (this.#scrollDelta.y !== 0) {
      this.#scrollDelta.y = 0;
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

  isMoving(): boolean {
    return this.#delta.x !== 0 || this.#delta.y !== 0;
  }

  isDown(
    action: InputMouseAction
  ): boolean {
    return new InputActionQuery(action).match({
      any: () => this.buttonsDown.some(Boolean),
      none: () => this.buttonsDown.every((isDown) => !isDown),
      value: (resolvedAction) => this.buttonsDown[this.#resolveButtonIndex(resolvedAction)] ?? false
    });
  }

  wasJustPressed(
    action: InputMouseAction
  ): boolean {
    return new InputActionQuery(action).match({
      any: () => this.buttons.some((button) => button.wasJustPressed),
      none: () => this.buttons.every((button) => !button.wasJustPressed),
      value: (resolvedAction) => this.buttons[this.#resolveButtonIndex(resolvedAction)]?.wasJustPressed ?? false
    });
  }

  wasJustReleased(
    action: InputMouseAction
  ): boolean {
    return new InputActionQuery(action).match({
      any: () => this.buttons.some((button) => button.wasJustReleased),
      none: () => this.buttons.every((button) => !button.wasJustReleased),
      value: (resolvedAction) => this.buttons[this.#resolveButtonIndex(resolvedAction)]?.wasJustReleased ?? false
    });
  }

  #resolveButtonIndex(
    action: number | MouseAction
  ): number {
    return typeof action === "number" ?
      action :
      MouseEventButton[action];
  }

  #onMouseMove = (event: MouseEvent) => {
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
      const rect = (event.target as Element).getBoundingClientRect();
      this.newPosition = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }

    this.emit("move", event);
  };

  #onMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    this.#canvas.focus();
    this.buttonsDown[event.button] = true;

    if (this.#wantsPointerLock && !this.#wasPointerLocked) {
      this.#canvas.requestPointerLock();
    }
    this.emit("down", event);
  };

  #onMouseUp = (event: MouseEvent) => {
    if (this.buttonsDown[event.button]) {
      event.preventDefault();
    }
    this.buttonsDown[event.button] = false;

    if (this.#wantsPointerLock && !this.#wasPointerLocked) {
      this.#canvas.requestPointerLock();
    }
    this.emit("up", event);
  };

  #onMouseDoubleClick = (event: MouseEvent) => {
    event.preventDefault();
    this.buttons[event.button].doubleClicked = true;
  };

  #onMouseWheel = (event: WheelEvent) => {
    event.preventDefault();
    const [deltaX, deltaY] = Mouse.getWheelDelta(event);

    this.#scrollDelta = { x: deltaX, y: deltaY };
    this.emit("wheel", event);

    return false;
  };

  #onPointerLockChange = () => {
    const isPointerLocked = this.locked;
    if (this.#wasPointerLocked !== isPointerLocked) {
      this.emit(
        "lockStateChange",
        isPointerLocked ? "locked" : "unlocked"
      );
      this.#wasPointerLocked = isPointerLocked;
    }
  };

  #onPointerLockError = () => {
    if (this.#wasPointerLocked) {
      this.emit(
        "lockStateChange",
        "unlocked"
      );
      this.#wasPointerLocked = false;
    }
  };
}
