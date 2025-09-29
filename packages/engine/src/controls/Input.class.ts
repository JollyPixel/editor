// Import Third-party Dependencies
import * as THREE from "three";
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import * as sources from "./targets/index.js";
import {
  BrowserWindowAdapter,
  type WindowAdapter
} from "../adapters/index.js";
import type {
  InputControl
} from "./types.js";

export type { MouseEventButton } from "./targets/Mouse.class.js";

export type InputEvents = {
  exit: [];
};

export interface InputOptions {
  /**
   * @default false
   */
  enableOnExit?: boolean;
  windowAdapter?: WindowAdapter;
}

export type InputMouseAction =
  | number
  | keyof typeof sources.MouseEventButton
  | "ANY"
  | "NONE";

export type InputKeyboardAction = string | "ANY" | "NONE";

export class Input extends EventEmitter<InputEvents> {
  #canvas: HTMLCanvasElement;
  #windowAdapter: WindowAdapter;

  mouse: sources.Mouse;
  touchpad: sources.Touchpad;
  gamepad: sources.Gamepad;
  fullscreen: sources.Fullscreen;
  keyboard: sources.Keyboard;

  exited = false;

  constructor(
    canvas: HTMLCanvasElement,
    options: InputOptions = {}
  ) {
    super();
    const {
      enableOnExit = false,
      windowAdapter = new BrowserWindowAdapter()
    } = options;

    this.#canvas = canvas;
    this.#windowAdapter = windowAdapter;
    const fullscreen = new sources.Fullscreen({
      canvas
    });
    this.mouse = new sources.Mouse({
      canvas,
      mouseDownCallback: () => fullscreen.onMouseDown(),
      mouseUpCallback: () => fullscreen.onMouseUp()
    });
    this.fullscreen = fullscreen;
    this.touchpad = new sources.Touchpad({
      canvas,
      mouse: this.mouse
    });
    this.gamepad = new sources.Gamepad({
      navigatorAdapter: this.#windowAdapter.navigator
    });
    this.keyboard = new sources.Keyboard();

    if (enableOnExit) {
      this.#windowAdapter.onbeforeunload = this.doExitCallback;
    }
  }

  #sourceInputs(): InputControl[] {
    return [
      this.mouse,
      this.touchpad,
      this.keyboard,
      this.gamepad
    ];
  }

  connect() {
    [...this.#sourceInputs(), this.fullscreen]
      .forEach((subscriber) => subscriber.connect?.());
    this.#windowAdapter.addEventListener("blur", this.onBlur);
  }

  disconnect() {
    [...this.#sourceInputs(), this.fullscreen]
      .forEach((subscriber) => subscriber.disconnect?.());
    this.#windowAdapter.removeEventListener("blur", this.onBlur);
  }

  enterFullscreen() {
    this.fullscreen.enter();
  }

  exitFullscreen() {
    this.fullscreen.exit();
  }

  update() {
    this.#sourceInputs()
      .forEach((subscriber) => subscriber.update());
  }

  getScreenSize() {
    return new THREE.Vector2(this.#canvas.clientWidth, this.#canvas.clientHeight);
  }

  getMouseVisible() {
    return this.#canvas.style.cursor !== "none";
  }

  setMouseVisible(visible: boolean) {
    this.#canvas.style.cursor = visible ? "auto" : "none";
  }

  lockMouse() {
    this.mouse.lock();
  }

  unlockMouse() {
    this.mouse.unlock();
  }

  isMouseMoving(): boolean {
    const delta = this.mouse.delta;

    return delta.x !== 0 || delta.y !== 0;
  }

  getMousePosition() {
    const position = this.mouse.position;
    const x = (position.x / this.#canvas.clientWidth) * 2;
    const y = (position.y / this.#canvas.clientHeight) * 2;

    return new THREE.Vector2(x - 1, (y - 1) * -1);
  }

  getMouseDelta() {
    const delta = this.mouse.delta;
    const x = (delta.x / this.#canvas.clientWidth) * 2;
    const y = (delta.y / this.#canvas.clientHeight) * -2;

    return new THREE.Vector2(x, y);
  }

  isMouseButtonDown(
    action: InputMouseAction
  ): boolean {
    if (action === "ANY") {
      return this.mouse.buttonsDown.length > 0;
    }
    if (action === "NONE") {
      return this.mouse.buttonsDown.length === 0;
    }

    const index = typeof action === "number" ? action : sources.MouseEventButton[action];

    return this.mouse.buttonsDown[index];
  }

  wasMouseButtonJustReleased(
    action: InputMouseAction
  ): boolean {
    if (action === "ANY") {
      return this.mouse.buttons.some((button) => button.wasJustReleased);
    }
    if (action === "NONE") {
      return this.mouse.buttons.every((button) => !button.wasJustReleased);
    }

    const index = typeof action === "number" ? action : sources.MouseEventButton[action];

    return this.mouse.buttons[index]?.wasJustReleased ?? false;
  }

  wasMouseButtonJustPressed(
    action: InputMouseAction
  ): boolean {
    if (action === "ANY") {
      return this.mouse.buttons.some((button) => button.wasJustPressed);
    }
    if (action === "NONE") {
      return this.mouse.buttons.every((button) => !button.wasJustPressed);
    }
    const index = typeof action === "number" ? action : sources.MouseEventButton[action];

    return this.mouse.buttons[index]?.wasJustPressed ?? false;
  }

  getTouchPosition(index: number) {
    if (index < 0 || index >= this.touchpad.touches.length) {
      throw new Error(`Touch index ${index} is out of bounds.`);
    }

    const position = this.touchpad.touches[index].position;
    const x = (position.x / this.#canvas.clientWidth) * 2;
    const y = (position.y / this.#canvas.clientHeight) * 2;

    return new THREE.Vector2(
      x - 1,
      (y - 1) * -1
    );
  }

  isTouchDown(
    index: number
  ): boolean {
    if (index < 0 || index >= this.touchpad.touchesDown.length) {
      throw new Error(`Touch index ${index} is out of bounds.`);
    }

    return this.touchpad.touchesDown[index];
  }

  wasTouchStarted(
    index: number
  ): boolean {
    if (index < 0 || index >= this.touchpad.touches.length) {
      throw new Error(`Touch index ${index} is out of bounds.`);
    }

    return this.touchpad.touches[index].wasStarted;
  }

  wasTouchEnded(
    index: number
  ): boolean {
    if (index < 0 || index >= this.touchpad.touches.length) {
      throw new Error(`Touch index ${index} is out of bounds.`);
    }

    return this.touchpad.touches[index].wasEnded;
  }

  vibrate(
    pattern: VibratePattern
  ): void {
    this.#windowAdapter.navigator.vibrate(pattern);
  }

  isKeyDown(
    key: InputKeyboardAction
  ): boolean {
    if (key === "ANY") {
      return this.keyboard.buttonsDown.size > 0;
    }
    if (key === "NONE") {
      return this.keyboard.buttonsDown.size === 0;
    }

    return this.keyboard.buttonsDown.has(key);
  }

  wasKeyJustPressed(
    key: InputKeyboardAction
  ): boolean {
    if (key === "ANY") {
      return Array.from(this.keyboard.buttons.values())
        .some((button) => button.wasJustPressed);
    }
    if (key === "NONE") {
      return Array.from(this.keyboard.buttons.values())
        .every((button) => !button.wasJustPressed);
    }

    const keyState = this.keyboard.buttons.get(key);

    return keyState?.wasJustPressed ?? false;
  }

  wasKeyJustReleased(
    key: InputKeyboardAction
  ): boolean {
    if (key === "ANY") {
      return Array.from(this.keyboard.buttons.values())
        .some((button) => button.wasJustReleased);
    }
    if (key === "NONE") {
      return Array.from(this.keyboard.buttons.values())
        .every((button) => !button.wasJustReleased);
    }
    const keyState = this.keyboard.buttons.get(key);

    return keyState?.wasJustReleased ?? false;
  }

  wasKeyJustAutoRepeated(
    key: InputKeyboardAction
  ): boolean {
    const keyState = this.keyboard.buttons.get(key);

    return keyState?.wasJustAutoRepeated ?? false;
  }

  getTextEntered() {
    return this.keyboard.char;
  }

  isGamepadButtonDown(
    gamepad: 0 | 1 | 2 | 3,
    key: number
  ) {
    if (!this.gamepad.buttons[gamepad][key]) {
      throw new Error("Invalid gamepad info");
    }

    return this.gamepad.buttons[gamepad][key].isDown;
  }

  wasGamepadButtonJustPressed(
    gamepad: 0 | 1 | 2 | 3,
    key: number
  ) {
    if (!this.gamepad.buttons[gamepad][key]) {
      throw new Error("Invalid gamepad info");
    }

    return this.gamepad.buttons[gamepad][key].wasJustPressed;
  }

  wasGamepadButtonJustReleased(
    gamepad: 0 | 1 | 2 | 3,
    key: number
  ) {
    if (!this.gamepad.buttons[gamepad][key]) {
      throw new Error("Invalid gamepad info");
    }

    return this.gamepad.buttons[gamepad][key].wasJustReleased;
  }

  setGamepadAxisDeadZone(
    deadZone: number
  ) {
    this.gamepad.axisDeadZone = deadZone;
  }

  getGamepadAxisDeadZone() {
    return this.gamepad.axisDeadZone;
  }

  wasGamepadAxisJustPressed(
    gamepad: 0 | 1 | 2 | 3,
    axis: number,
    options: { autoRepeat?: boolean; positive?: boolean; } = {}
  ) {
    const axisInfo = this.gamepad.axes[gamepad][axis];
    if (!axisInfo) {
      throw new Error("Invalid gamepad info");
    }
    const { autoRepeat = false, positive = false } = options;

    if (positive) {
      return axisInfo.wasPositiveJustPressed || (autoRepeat && axisInfo.wasPositiveJustAutoRepeated);
    }

    return axisInfo.wasNegativeJustPressed || (autoRepeat && axisInfo.wasNegativeJustAutoRepeated);
  }

  wasGamepadAxisJustReleased(
    gamepad: 0 | 1 | 2 | 3,
    axis: number,
    options: { positive?: boolean; } = {}
  ) {
    const axisInfo = this.gamepad.axes[gamepad][axis];
    if (!axisInfo) {
      throw new Error("Invalid gamepad info");
    }

    return options.positive ?
      axisInfo.wasPositiveJustReleased :
      axisInfo.wasNegativeJustReleased;
  }

  getGamepadAxisValue(
    gamepad: 0 | 1 | 2 | 3,
    axis: number
  ) {
    if (!this.gamepad.axes[gamepad][axis]) {
      throw new Error("Invalid gamepad info");
    }

    return this.gamepad.axes[gamepad][axis].value;
  }

  getGamepadButtonValue(
    gamepad: 0 | 1 | 2 | 3,
    button: number
  ) {
    if (!this.gamepad.buttons[gamepad][button]) {
      throw new Error("Invalid gamepad info");
    }

    return this.gamepad.buttons[gamepad][button].value;
  }

  private onBlur = () => {
    this.#sourceInputs()
      .forEach((subscriber) => subscriber.reset());
  };

  private doExitCallback = () => {
    // NOTE: It seems window.onbeforeunload might be called twice
    // in some circumstances so we check if the callback was cleared already
    // http://stackoverflow.com/questions/8711393/onbeforeunload-fires-twice
    if (!this.exited) {
      this.emit("exit");
    }
    this.exited = true;
  };
}
