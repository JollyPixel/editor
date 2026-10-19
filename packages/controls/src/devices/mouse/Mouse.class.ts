// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  BrowserDocumentAdapter,
  type DocumentAdapter,
  type CanvasAdapter,
  type EventTargetListener
} from "../../adapters/index.ts";
import type {
  InputControl,
  InputCustomAction,
  InputReader,
  Vector2Like
} from "../../types.ts";
import {
  ControlBank,
  type ControlQuery
} from "../ControlBank.ts";
import { ReaderBuffer } from "../ReaderBuffer.ts";
import { MotionSample } from "./MotionSample.ts";
import {
  WheelGesture,
  type LegacyWheelEvent,
  type ScrollDevice,
  type ScrollSource
} from "./WheelGesture.ts";
import { isApplePlatform } from "../../platform.ts";

export type {
  LegacyWheelEvent,
  ScrollDevice,
  ScrollSource
} from "./WheelGesture.ts";

// CONSTANTS
const kButtonCount = 7;
const kDragButtonCount = 5;

export interface MouseButtonState {
  isDown: boolean;
  doubleClicked: boolean;
  wasJustPressed: boolean;
  wasJustReleased: boolean;
}

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
  wheel: (event: WheelEvent) => void;
  enter: () => void;
  leave: () => void;
};

export interface MouseOptions {
  canvas: CanvasAdapter;
  documentAdapter?: DocumentAdapter;
}

export class Mouse extends Emitter<
  MouseEvents
> implements InputControl {
  static wheelDelta(
    event: LegacyWheelEvent
  ): [number, number] {
    if (isApplePlatform()) {
      switch (event.deltaMode) {
        case event.DOM_DELTA_LINE:
        case event.DOM_DELTA_PAGE:
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
        -(event.wheelDeltaX ?? 0) / 120,
        (event.wheelDeltaY ?? 0) / 120
      ];
    }
  }

  #canvas: CanvasAdapter;
  #documentAdapter: DocumentAdapter;

  #buttons = new ControlBank<number>();

  #position = {
    x: 0,
    y: 0
  };
  #newPosition: Vector2Like | null = null;
  #newPositionSlot = {
    x: 0,
    y: 0
  };

  #delta = new ReaderBuffer(() => new MotionSample());
  #scroll = new ReaderBuffer(() => new MotionSample<ScrollSource>());
  #wheelGesture = new WheelGesture();

  #canvasEvent: MouseEvent | null = null;
  #touchIdentifier: number | null = null;
  #hovering = false;
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
    return this.#buttons.active;
  }

  get hovering() {
    return this.#hovering;
  }

  connect() {
    for (const [type, listener] of this.#canvasListeners()) {
      this.#canvas.addEventListener(type, listener);
    }
    for (const [type, listener] of this.#documentListeners()) {
      this.#documentAdapter.addEventListener(type, listener);
    }
  }

  disconnect() {
    for (const [type, listener] of this.#canvasListeners()) {
      this.#canvas.removeEventListener(type, listener);
    }
    for (const [type, listener] of this.#documentListeners()) {
      this.#documentAdapter.removeEventListener(type, listener);
    }
  }

  #canvasListeners(): Array<[string, EventTargetListener]> {
    return [
      ["mousemove", this.#onMouseMove],
      ["mousedown", this.#onMouseDown],
      ["mouseup", this.#onMouseUp],
      ["dblclick", this.#onMouseDoubleClick],
      ["wheel", this.#onMouseWheel],
      ["mouseenter", this.#onMouseEnter],
      ["mouseleave", this.#onMouseLeave],
      ["touchstart", this.#onTouchStart],
      ["touchmove", this.#onTouchMove],
      ["touchend", this.#onTouchEnd],
      ["touchcancel", this.#onTouchEnd]
    ];
  }

  #documentListeners(): Array<[string, EventTargetListener]> {
    return [
      ["mousemove", this.#onDocumentMouseMove],
      ["mouseup", this.#onDocumentMouseUp],
      ["pointerlockchange", this.#onPointerLockChange],
      ["pointerlockerror", this.#onPointerLockError]
    ];
  }

  reset() {
    this.#scroll.reset();
    this.#wheelGesture.reset();
    this.#canvasEvent = null;
    this.#touchIdentifier = null;
    this.#updateHovering(false);
    this.#buttons.reset();

    this.#position.x = 0;
    this.#position.y = 0;
    this.#newPosition = null;

    this.#delta.reset();
  }

  get scrollUp() {
    return this.#buttons.wasPressed(MouseEventButton.scrollUp);
  }

  get scrollDown() {
    return this.#buttons.wasPressed(MouseEventButton.scrollDown);
  }

  get scroll() {
    return this.scrollTo({ x: 0, y: 0 });
  }

  scrollTo<T extends Vector2Like>(
    out: T
  ): T {
    out.x = this.#scroll.published.x;
    out.y = this.#scroll.published.y;

    return out;
  }

  get scrollSource(): ScrollSource | null {
    return this.#scroll.published.source;
  }

  get scrollDevice(): ScrollDevice {
    return this.#wheelGesture.device;
  }

  set scrollDevice(
    device: ScrollDevice
  ) {
    this.#wheelGesture.device = device;
  }

  isScrolling(): boolean {
    return this.#scroll.published.x !== 0 ||
      this.#scroll.published.y !== 0;
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
    out.x = this.#delta.published.x;
    out.y = this.#delta.published.y;

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
    this.#delta.queued.clear();
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
      out.x = this.#delta.published.x / (this.#canvas.clientWidth / 2);
      out.y = -this.#delta.published.y / (this.#canvas.clientHeight / 2);

      return out;
    }

    out.x = this.#delta.published.x;
    out.y = -this.#delta.published.y;

    return out;
  }

  update() {
    this.sample();
    this.publish("step");
  }

  sample(): void {
    this.#sampleScroll();
    this.#sampleMotion();
    this.#buttons.sample();
    this.#delta.sample();
    this.#scroll.sample();
  }

  publish(
    reader: InputReader
  ): void {
    this.#buttons.publish(reader);
    this.#delta.publish(reader);
    this.#scroll.publish(reader);
  }

  #sampleScroll(): void {
    const { y } = this.#scroll.queued;
    if (y === 0) {
      return;
    }

    const button = y > 0 ?
      MouseEventButton.scrollUp :
      MouseEventButton.scrollDown;
    this.#buttons.press(button);
    this.#buttons.release(button);
  }

  #sampleMotion(): void {
    if (
      this.#newPosition === null ||
      (this.#wantsPointerLock && this.#wasPointerLocked)
    ) {
      return;
    }

    this.#delta.queued.add(
      this.#newPosition.x - this.#position.x,
      this.#newPosition.y - this.#position.y
    );
    this.#position.x = this.#newPosition.x;
    this.#position.y = this.#newPosition.y;
    this.#newPosition = null;
  }

  isMoving(): boolean {
    return this.#delta.published.x !== 0 || this.#delta.published.y !== 0;
  }

  isDown(
    action: InputMouseAction
  ): boolean {
    const query = Mouse.#buttonQuery(action);
    switch (query) {
      case "ANY":
        return this.#buttons.isDown("ANY") || this.scrollUp || this.scrollDown;
      case "NONE":
        return !this.isDown("ANY");
      case MouseEventButton.scrollUp:
      case MouseEventButton.scrollDown:
        return this.#buttons.wasPressed(query);
      default:
        return this.#buttons.isDown(query);
    }
  }

  wasJustPressed(
    action: InputMouseAction
  ): boolean {
    return this.#buttons.wasPressed(Mouse.#buttonQuery(action));
  }

  wasJustReleased(
    action: InputMouseAction
  ): boolean {
    return this.#buttons.wasReleased(Mouse.#buttonQuery(action));
  }

  buttonState(
    action: number | MouseAction
  ): Readonly<MouseButtonState> {
    const button = Mouse.#buttonIndex(action);

    return {
      isDown: this.isDown(button),
      doubleClicked: this.#buttons.wasRepeated(button),
      wasJustPressed: this.#buttons.wasPressed(button),
      wasJustReleased: this.#buttons.wasReleased(button)
    };
  }

  #toggle(
    button: number,
    down: boolean
  ): void {
    if (button !== -1) {
      this.#buttons.follow(button, down);
    }
  }

  #isDragging(): boolean {
    for (let button = 0; button < kDragButtonCount; button++) {
      if (this.#buttons.isDown(button)) {
        return true;
      }
    }

    return false;
  }

  #canvasRelativePosition(
    point: {
      clientX: number;
      clientY: number;
    }
  ): boolean {
    const rect = this.#canvas.getBoundingClientRect?.();
    if (!rect) {
      return false;
    }

    this.#newPositionSlot.x = point.clientX - rect.left;
    this.#newPositionSlot.y = point.clientY - rect.top;
    this.#newPosition = this.#newPositionSlot;

    return true;
  }

  #updateHovering(
    hovering: boolean
  ): void {
    if (this.#hovering === hovering) {
      return;
    }

    this.#hovering = hovering;
    this.emit(hovering ? "enter" : "leave");
  }

  #primaryTouch(
    event: TouchEvent
  ): Touch | null {
    for (let index = 0; index < event.changedTouches.length; index++) {
      const touch = event.changedTouches[index];
      if (touch.identifier === this.#touchIdentifier) {
        return touch;
      }
    }

    return null;
  }

  #onMouseEnter = () => {
    this.#updateHovering(true);
  };

  #onMouseLeave = () => {
    this.#updateHovering(false);
  };

  #onMouseMove = (event: MouseEvent) => {
    this.#canvasEvent = event;
    event.preventDefault();
    this.#updateHovering(true);

    if (this.#wantsPointerLock) {
      if (this.#wasPointerLocked && event.movementX !== null) {
        this.#delta.queued.add(event.movementX, event.movementY);
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

      this.#newPosition = position;
    }

    this.emit("move", event);
  };

  #onMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    this.#canvas.focus();
    this.#toggle(Mouse.#buttonIndex(event.button), true);

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
    this.#toggle(Mouse.#buttonIndex(event.button), false);

    if (this.#wantsPointerLock && !this.#wasPointerLocked) {
      this.#canvas.requestPointerLock();
    }
    this.emit("up", event);
  };

  #onMouseDoubleClick = (event: MouseEvent) => {
    event.preventDefault();
    const button = Mouse.#buttonIndex(event.button);
    if (button !== -1) {
      this.#buttons.repeat(button);
    }
  };

  #onMouseWheel = (event: LegacyWheelEvent) => {
    event.preventDefault();
    const source = this.#wheelGesture.classify(event);
    const [deltaX, deltaY] = Mouse.wheelDelta(event);

    this.#scroll.queued.add(deltaX, deltaY, source);
    this.emit("wheel", event);

    return false;
  };

  #onTouchStart = (event: TouchEvent) => {
    event.preventDefault();
    if (this.#touchIdentifier !== null) {
      return;
    }

    const touch = event.changedTouches[0];
    if (touch === undefined) {
      return;
    }

    this.#touchIdentifier = touch.identifier;
    this.#canvasRelativePosition(touch);
    this.#buttons.press(MouseEventButton.left);
    this.#updateHovering(true);
  };

  #onTouchMove = (event: TouchEvent) => {
    event.preventDefault();
    const touch = this.#primaryTouch(event);
    if (touch !== null) {
      this.#canvasRelativePosition(touch);
    }
  };

  #onTouchEnd = (event: TouchEvent) => {
    event.preventDefault();
    if (this.#primaryTouch(event) === null) {
      return;
    }

    this.#touchIdentifier = null;
    this.#buttons.release(MouseEventButton.left);
    this.#updateHovering(false);
  };

  #onDocumentMouseMove = (event: MouseEvent) => {
    if (
      event === this.#canvasEvent ||
      this.#wantsPointerLock ||
      !this.#isDragging()
    ) {
      return;
    }

    if (!this.#canvasRelativePosition(event)) {
      return;
    }

    this.emit("move", event);
  };

  #onDocumentMouseUp = (event: MouseEvent) => {
    if (
      event === this.#canvasEvent ||
      !this.isDown(event.button)
    ) {
      return;
    }

    this.#toggle(Mouse.#buttonIndex(event.button), false);

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

  static #buttonIndex(
    action: number | MouseAction
  ): number {
    const index = typeof action === "number" ?
      action :
      MouseEventButton[action];

    return index >= 0 && index < kButtonCount ? index : -1;
  }

  static #buttonQuery(
    action: InputMouseAction
  ): ControlQuery<number> {
    return action === "ANY" || action === "NONE" ?
      action :
      Mouse.#buttonIndex(action);
  }
}
