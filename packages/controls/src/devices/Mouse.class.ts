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
import {
  TouchIdentifier,
  type TouchPosition
} from "./Touchpad.class.ts";
import { MouseMask } from "./MouseMask.ts";

// CONSTANTS
const kApplePlatform = /^Mac|iPhone|iPod|iPad/i;
/** Every index in `MouseEventButton`, hence every bit the state masks use. */
const kButtonCount = 7;
const kScrollMask = (1 << 5) | (1 << 6);

/** Cached lazily to avoid browser globals during module import. */
let applePlatform: boolean | null = null;

function isApplePlatform(): boolean {
  if (applePlatform === null) {
    applePlatform = typeof navigator !== "undefined" &&
      kApplePlatform.test(navigator.platform);
  }

  return applePlatform;
}

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
  static wheelDelta(
    event: WheelEvent
  ): [number, number] {
    if (isApplePlatform()) {
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

  /** Live DOM state and the last published state, stored as bitsets. */
  #downMask = 0;
  #prevMask = 0;
  #pressed = new MouseMask();
  #released = new MouseMask();
  #doubleClicked = new MouseMask();
  #scroll = new MouseMask();

  #position = {
    x: 0,
    y: 0
  };
  newPosition: { x: number; y: number; } | null = null;

  /** Reused by `#onMouseMove`; `newPosition` points at this or is null. */
  #newPositionSlot = {
    x: 0,
    y: 0
  };

  #delta = {
    x: 0,
    y: 0
  };
  #frameDelta = {
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
  #scrollSample = {
    x: 0,
    y: 0
  };
  #frameScroll = {
    x: 0,
    y: 0
  };

  /**
   * Canvas event already handled by the canvas listener. Document listeners
   * see the same object once it bubbles and must not process it twice.
   */
  #canvasEvent: MouseEvent | null = null;

  #wasActive = false;
  #settled = true;
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
      "mousemove",
      this.#onDocumentMouseMove
    );
    this.#documentAdapter.addEventListener(
      "mouseup",
      this.#onDocumentMouseUp
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
      "mousemove",
      this.#onDocumentMouseMove
    );
    this.#documentAdapter.removeEventListener(
      "mouseup",
      this.#onDocumentMouseUp
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
    this.#scrollSample.x = 0;
    this.#scrollSample.y = 0;
    this.#frameScroll.x = 0;
    this.#frameScroll.y = 0;
    this.#canvasEvent = null;
    this.#downMask = 0;
    this.#prevMask = 0;
    this.#pressed.reset();
    this.#released.reset();
    this.#doubleClicked.reset();
    this.#scroll.reset();

    this.#position.x = 0;
    this.#position.y = 0;
    this.newPosition = null;

    this.#delta.x = 0;
    this.#delta.y = 0;
    this.#frameDelta.x = 0;
    this.#frameDelta.y = 0;
    this.newDelta.x = 0;
    this.newDelta.y = 0;
  }

  get scrollUp() {
    return (this.#downMask & (1 << MouseEventButton.scrollUp)) !== 0;
  }

  get scrollDown() {
    return (this.#downMask & (1 << MouseEventButton.scrollDown)) !== 0;
  }

  get scroll() {
    return this.scrollTo({ x: 0, y: 0 });
  }

  scrollTo<T extends Vector2Like>(
    out: T
  ): T {
    out.x = this.#scrollSample.x;
    out.y = this.#scrollSample.y;

    return out;
  }

  isScrolling(): boolean {
    return this.#scrollSample.x !== 0 || this.#scrollSample.y !== 0;
  }

  get position() {
    return this.positionTo({ x: 0, y: 0 });
  }

  positionTo<T extends Vector2Like>(
    out: T
  ): T {
    out.x = this.#position.x;
    out.y = this.#position.y;

    return out;
  }

  get delta() {
    return this.deltaTo({ x: 0, y: 0 });
  }

  deltaTo<T extends Vector2Like>(
    out: T
  ): T {
    out.x = this.#delta.x;
    out.y = this.#delta.y;

    return out;
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

    this.#wantsPointerLock = false;
    this.#wasPointerLocked = false;
    if (isLocked) {
      this.#documentAdapter.exitPointerLock();
    }
  }

  get visible(): boolean {
    return this.#canvas.style.cursor !== "none";
  }

  set visible(
    visible: boolean
  ) {
    this.#canvas.style.cursor = visible ? "auto" : "none";
  }

  get viewportPosition(): Vector2Like {
    return this.viewportPositionTo({ x: 0, y: 0 });
  }

  viewportPositionTo<T extends Vector2Like>(
    out: T
  ): T {
    const x = (this.#position.x / this.#canvas.clientWidth) * 2;
    const y = (this.#position.y / this.#canvas.clientHeight) * 2;

    out.x = x - 1;
    out.y = (y - 1) * -1;

    return out;
  }

  get worldPosition(): Vector2Like {
    return this.worldPositionTo({ x: 0, y: 0 });
  }

  worldPositionTo<T extends Vector2Like>(
    out: T
  ): T {
    this.viewportPositionTo(out);
    out.x *= this.#canvas.clientWidth / 2;
    out.y *= this.#canvas.clientHeight / 2;

    return out;
  }

  viewportDelta(
    normalizeWithSize = false
  ): Vector2Like {
    return this.viewportDeltaTo({ x: 0, y: 0 }, normalizeWithSize);
  }

  viewportDeltaTo<T extends Vector2Like>(
    out: T,
    normalizeWithSize = false
  ): T {
    if (normalizeWithSize) {
      out.x = this.#delta.x / (this.#canvas.clientWidth / 2);
      out.y = -this.#delta.y / (this.#canvas.clientHeight / 2);

      return out;
    }

    out.x = this.#delta.x;
    out.y = -this.#delta.y;

    return out;
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
      this.#setButton(MouseEventButton.left, buttonValue);
    }
    if (position) {
      this.newPosition = position;
    }
  }

  update() {
    if (this.#settled && this.#isQuiet()) {
      return;
    }

    const scrollBits =
      (Number(this.#scrollDelta.y > 0) << MouseEventButton.scrollUp) |
      (Number(this.#scrollDelta.y < 0) << MouseEventButton.scrollDown);
    this.#scroll.sample(scrollBits);
    this.#downMask = (this.#downMask & ~kScrollMask) |
      this.#scroll.value;

    this.#scrollSample.x = this.#scrollDelta.x;
    this.#scrollSample.y = this.#scrollDelta.y;
    this.#frameScroll.x += this.#scrollDelta.x;
    this.#frameScroll.y += this.#scrollDelta.y;
    this.#scrollDelta.x = 0;
    this.#scrollDelta.y = 0;

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
    this.#frameDelta.x += this.#delta.x;
    this.#frameDelta.y += this.#delta.y;

    const isDown = this.#downMask;
    const wasDown = this.#prevMask;

    this.#pressed.sample(~wasDown & isDown);
    this.#released.sample(wasDown & ~isDown);
    this.#prevMask = isDown;
    this.#doubleClicked.sample();

    this.#wasActive = isDown !== 0;
    this.#settled = isDown === 0 &&
      wasDown === 0 &&
      !this.#pressed.any &&
      !this.#released.any &&
      !this.#doubleClicked.any &&
      this.#delta.x === 0 &&
      this.#delta.y === 0;
  }

  /**
   * Re-publishes transient state accumulated across input samples so a
   * rendered update cannot miss an edge consumed by an earlier fixed step.
   */
  publishFrameState(): void {
    this.#pressed.publishFrame();
    this.#released.publishFrame();
    this.#doubleClicked.publishFrame();
    this.#scroll.publishFrame();
    this.#downMask = (this.#downMask & ~kScrollMask) |
      this.#scroll.value;
    this.#delta.x = this.#frameDelta.x;
    this.#delta.y = this.#frameDelta.y;
    this.#scrollSample.x = this.#frameScroll.x;
    this.#scrollSample.y = this.#frameScroll.y;

    this.#frameDelta.x = 0;
    this.#frameDelta.y = 0;
    this.#frameScroll.x = 0;
    this.#frameScroll.y = 0;

    if (
      this.#pressed.any ||
      this.#released.any ||
      this.#doubleClicked.any ||
      this.#delta.x !== 0 ||
      this.#delta.y !== 0
    ) {
      this.#settled = false;
    }
  }

  #isQuiet(): boolean {
    return this.newPosition === null &&
      this.#scrollDelta.x === 0 &&
      this.#scrollDelta.y === 0 &&
      this.newDelta.x === 0 &&
      this.newDelta.y === 0 &&
      !this.#pressed.queued &&
      !this.#released.queued &&
      !this.#doubleClicked.queued &&
      this.#downMask === 0;
  }

  isMoving(): boolean {
    return this.#delta.x !== 0 || this.#delta.y !== 0;
  }

  isDown(
    action: InputMouseAction
  ): boolean {
    if (action === "ANY") {
      return this.#downMask !== 0;
    }
    if (action === "NONE") {
      return this.#downMask === 0;
    }

    return (
      this.#downMask & this.#buttonBit(action)
    ) !== 0;
  }

  wasJustPressed(
    action: InputMouseAction
  ): boolean {
    if (action === "ANY") {
      return this.#pressed.any;
    }
    if (action === "NONE") {
      return !this.#pressed.any;
    }

    return this.#pressed.has(
      this.#buttonBit(action)
    );
  }

  wasJustReleased(
    action: InputMouseAction
  ): boolean {
    if (action === "ANY") {
      return this.#released.any;
    }
    if (action === "NONE") {
      return !this.#released.any;
    }

    return this.#released.has(
      this.#buttonBit(action)
    );
  }

  buttonState(
    action: number | MouseAction
  ): Readonly<MouseButtonState> {
    const bit = this.#buttonBit(action);

    return {
      isDown: (this.#prevMask & bit) !== 0,
      doubleClicked: this.#doubleClicked.has(bit),
      wasJustPressed: this.#pressed.has(bit),
      wasJustReleased: this.#released.has(bit)
    };
  }

  #buttonBit(
    action: number | MouseAction
  ): number {
    const index = typeof action === "number" ?
      action :
      MouseEventButton[action];

    return index >= 0 && index < kButtonCount ? 1 << index : 0;
  }

  #setButton(
    index: number,
    value: boolean
  ): void {
    const bit = this.#buttonBit(index);
    const wasDown = (this.#downMask & bit) !== 0;

    if (value && !wasDown) {
      this.#pressed.queue(bit);
    }
    else if (!value && wasDown) {
      this.#released.queue(bit);
    }

    this.#downMask = value ?
      this.#downMask | bit :
      this.#downMask & ~bit;
  }

  #isDragging(): boolean {
    return (this.#downMask & ~kScrollMask) !== 0;
  }

  #canvasRelativePosition(
    event: MouseEvent,
    out: { x: number; y: number; }
  ): boolean {
    const rect = this.#canvas.getBoundingClientRect?.();
    if (!rect) {
      return false;
    }

    out.x = event.clientX - rect.left;
    out.y = event.clientY - rect.top;

    return true;
  }

  #onMouseMove = (event: MouseEvent) => {
    this.#canvasEvent = event;
    event.preventDefault();

    if (this.#wantsPointerLock) {
      if (this.#wasPointerLocked && event.movementX !== null) {
        this.newDelta.x += event.movementX;
        this.newDelta.y += event.movementY;
      }
    }
    else {
      const position = this.#newPositionSlot;

      if (
        typeof event.offsetX === "number" &&
        typeof event.offsetY === "number"
      ) {
        position.x = event.offsetX;
        position.y = event.offsetY;
      }
      else {
        const rect = (event.target as Element).getBoundingClientRect();
        position.x = event.clientX - rect.left;
        position.y = event.clientY - rect.top;
      }

      this.newPosition = position;
    }

    this.emit("move", event);
  };

  #onMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    this.#canvas.focus();
    this.#setButton(event.button, true);

    if (this.#wantsPointerLock && !this.#wasPointerLocked) {
      this.#canvas.requestPointerLock();
    }
    this.emit("down", event);
  };

  #onMouseUp = (event: MouseEvent) => {
    this.#canvasEvent = event;
    if (this.isDown(event.button)) {
      event.preventDefault();
    }
    this.#setButton(event.button, false);

    if (this.#wantsPointerLock && !this.#wasPointerLocked) {
      this.#canvas.requestPointerLock();
    }
    this.emit("up", event);
  };

  #onMouseDoubleClick = (event: MouseEvent) => {
    event.preventDefault();
    this.#doubleClicked.queue(
      this.#buttonBit(event.button)
    );
  };

  #onMouseWheel = (event: WheelEvent) => {
    event.preventDefault();
    const [deltaX, deltaY] = Mouse.wheelDelta(event);

    // Accumulate every wheel event received between updates.
    this.#scrollDelta.x += deltaX;
    this.#scrollDelta.y += deltaY;
    this.emit("wheel", event);

    return false;
  };

  #onDocumentMouseMove = (event: MouseEvent) => {
    if (
      event === this.#canvasEvent ||
      this.#wantsPointerLock ||
      !this.#isDragging()
    ) {
      return;
    }

    const position = this.#newPositionSlot;
    if (!this.#canvasRelativePosition(event, position)) {
      return;
    }
    this.newPosition = position;

    this.emit("move", event);
  };

  #onDocumentMouseUp = (event: MouseEvent) => {
    if (
      event === this.#canvasEvent ||
      !this.isDown(event.button)
    ) {
      return;
    }

    this.#setButton(event.button, false);

    this.emit("up", event);
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
