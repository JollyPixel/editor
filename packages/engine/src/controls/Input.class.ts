// Import Third-party Dependencies
import * as THREE from "three";
import { EventEmitter } from "@posva/event-emitter";
import "reflect-metadata";

// Import Internal Dependencies
import * as devices from "./devices/index.js";
import {
  BrowserWindowAdapter,
  type WindowAdapter
} from "../adapters/index.js";
import { mapKeyToExtendedKey } from "./devices/keyboard/code.js";
import type {
  InputControl,
  InputMouseAction,
  InputKeyboardAction,
  InputCustomAction,
  KeyCode
} from "./types.js";

export type { MouseEventButton } from "./devices/Mouse.class.js";

/**
 * @note default stand for mouse + keyboard
 */
export type InputDevicePreference = "default" | "gamepad";

export type InputListener =
  | "input.devicePreferenceChange"
  | "input.exit"
  | "mouse.down"
  | "mouse.up"
  | "mouse.move"
  | "mouse.wheel"
  | "mouse.lockStateChange"
  | "gamepad.connect"
  | "gamepad.disconnect"
  | "touchpad.start"
  | "touchpad.move"
  | "touchpad.end"
  | "screen.stateChange"
  | "keyboard.down"
  | "keyboard.up"
  | "keyboard.press"
  | `keyboard.${KeyCode}`;

export interface InputListenerMetadata {
  type: InputListener;
  methodName: string;
}

export type InputEvents = {
  exit: [];
  devicePreferenceChange: [preference: InputDevicePreference];
};

export interface InputOptions {
  /**
   * @default false
   */
  enableOnExit?: boolean;
  windowAdapter?: WindowAdapter;
}

export class Input extends EventEmitter<InputEvents> {
  static Metadata = Symbol("InputMetadata");

  static listen(
    type: InputListener
  ) {
    return function fn(
      object: Object,
      methodName: string
    ) {
      const metadata = Reflect.getMetadata(
        Input.Metadata,
        object
      ) as InputListenerMetadata[] | undefined;

      const currentMethodMetadata: InputListenerMetadata = {
        type, methodName
      };
      Reflect.defineMetadata(
        Input.Metadata,
        metadata ?
          [...metadata, currentMethodMetadata] :
          [currentMethodMetadata],
        object
      );
    };
  }

  #canvas: HTMLCanvasElement;
  #windowAdapter: WindowAdapter;
  #preference: InputDevicePreference = "default";

  mouse: devices.Mouse;
  touchpad: devices.Touchpad;
  gamepad: devices.Gamepad;
  screen: devices.Screen;
  keyboard: devices.Keyboard;

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
    const fullscreen = new devices.Screen({
      canvas
    });
    this.mouse = new devices.Mouse({
      canvas
    });
    this.mouse.on("down", () => fullscreen.onMouseDown());
    this.mouse.on("up", () => fullscreen.onMouseUp());

    this.screen = fullscreen;
    this.touchpad = new devices.Touchpad({
      canvas
    });
    this.touchpad.on("start", (touch, position) => {
      this.mouse.synchronizeWithTouch(touch, true, position);
    });
    this.touchpad.on("end", (touch) => {
      this.mouse.synchronizeWithTouch(touch, false);
    });
    this.touchpad.on("move", (touch, position) => {
      this.mouse.synchronizeWithTouch(touch, void 0, position);
    });

    this.gamepad = new devices.Gamepad({
      navigatorAdapter: this.#windowAdapter.navigator
    });
    this.keyboard = new devices.Keyboard();

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
    [...this.#sourceInputs(), this.screen]
      .forEach((subscriber) => subscriber.connect?.());
    this.#windowAdapter.addEventListener("blur", this.onBlur);
    this.#windowAdapter.addEventListener("contextmenu", this.onContextMenu);
  }

  disconnect() {
    [...this.#sourceInputs(), this.screen]
      .forEach((subscriber) => subscriber.disconnect?.());
    this.#windowAdapter.removeEventListener("blur", this.onBlur);
    this.#windowAdapter.removeEventListener("contextmenu", this.onContextMenu);
  }

  getDevicePreference(): InputDevicePreference {
    return this.#preference;
  }

  isTouchpadAvailable() {
    return "ontouchstart" in document.documentElement;
  }

  enterFullscreen() {
    this.screen.enter();
  }

  exitFullscreen() {
    this.screen.exit();
  }

  update() {
    this.#sourceInputs()
      .forEach((subscriber) => subscriber.update());

    if (
      this.gamepad.wasActive &&
      this.#preference !== "gamepad"
    ) {
      this.#preference = "gamepad";
      this.emit("devicePreferenceChange", this.#preference);
    }
    else if (
      this.#preference !== "default" &&
      (this.keyboard.wasActive || this.mouse.wasActive || this.touchpad.wasActive)
    ) {
      this.#preference = "default";
      this.emit("devicePreferenceChange", this.#preference);
    }
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

  getMouseDelta(
    normalizeWithSize = false
  ) {
    const delta = this.mouse.delta;

    if (normalizeWithSize) {
      const x = delta.x / (this.#canvas.clientWidth / 2);
      const y = -delta.y / (this.#canvas.clientHeight / 2);

      return new THREE.Vector2(x, y);
    }

    return new THREE.Vector2(delta.x, -delta.y);
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

    const index = typeof action === "number" ? action : devices.MouseEventButton[action];

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

    const index = typeof action === "number" ? action : devices.MouseEventButton[action];

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
    const index = typeof action === "number" ? action : devices.MouseEventButton[action];

    return this.mouse.buttons[index]?.wasJustPressed ?? false;
  }

  getTouchPosition(
    index: number
  ) {
    const { position } = this.touchpad.getTouchState(index);
    const x = (position.x / this.#canvas.clientWidth) * 2;
    const y = (position.y / this.#canvas.clientHeight) * 2;

    return new THREE.Vector2(
      x - 1,
      (y - 1) * -1
    );
  }

  isTouchDown(
    index: devices.TouchAction
  ): boolean {
    return this.touchpad.getTouchState(index).isDown;
  }

  wasTouchStarted(
    index: devices.TouchAction
  ): boolean {
    return this.touchpad.getTouchState(index).wasStarted;
  }

  wasTouchEnded(
    index: devices.TouchAction
  ): boolean {
    return this.touchpad.getTouchState(index).wasEnded;
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

    return this.keyboard.buttonsDown.has(
      mapKeyToExtendedKey(key)
    );
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

    const keyState = this.keyboard.buttons.get(
      mapKeyToExtendedKey(key)
    );

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
    const keyState = this.keyboard.buttons.get(
      mapKeyToExtendedKey(key)
    );

    return keyState?.wasJustReleased ?? false;
  }

  wasKeyJustAutoRepeated(
    key: Exclude<InputKeyboardAction, InputCustomAction>
  ): boolean {
    const keyState = this.keyboard.buttons.get(
      mapKeyToExtendedKey(key)
    );

    return keyState?.wasJustAutoRepeated ?? false;
  }

  getTextEntered() {
    return this.keyboard.char;
  }

  isGamepadButtonDown(
    gamepad: devices.GamepadIndex,
    buttonIndex: number | keyof typeof devices.GamepadButton
  ) {
    const finalizedButtonIndex = typeof buttonIndex === "string" ?
      devices.GamepadButton[buttonIndex] : buttonIndex;

    if (!this.gamepad.buttons[gamepad][finalizedButtonIndex]) {
      throw new Error("Invalid gamepad info");
    }

    return this.gamepad.buttons[gamepad][finalizedButtonIndex].isDown;
  }

  wasGamepadButtonJustPressed(
    gamepad: devices.GamepadIndex,
    buttonIndex: number | keyof typeof devices.GamepadButton
  ) {
    const finalizedButtonIndex = typeof buttonIndex === "string" ?
      devices.GamepadButton[buttonIndex] : buttonIndex;

    if (!this.gamepad.buttons[gamepad][finalizedButtonIndex]) {
      throw new Error("Invalid gamepad info");
    }

    return this.gamepad.buttons[gamepad][finalizedButtonIndex].wasJustPressed;
  }

  wasGamepadButtonJustReleased(
    gamepad: devices.GamepadIndex,
    buttonIndex: number | keyof typeof devices.GamepadButton
  ) {
    const finalizedButtonIndex = typeof buttonIndex === "string" ?
      devices.GamepadButton[buttonIndex] : buttonIndex;

    if (!this.gamepad.buttons[gamepad][finalizedButtonIndex]) {
      throw new Error("Invalid gamepad info");
    }

    return this.gamepad.buttons[gamepad][finalizedButtonIndex].wasJustReleased;
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
    gamepad: devices.GamepadIndex,
    axis: number | keyof typeof devices.GamepadAxis,
    options: { autoRepeat?: boolean; positive?: boolean; } = {}
  ) {
    const finalizedAxisIndex = typeof axis === "string" ?
      devices.GamepadAxis[axis] : axis;

    const axisInfo = this.gamepad.axes[gamepad][finalizedAxisIndex];
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
    gamepad: devices.GamepadIndex,
    axis: number | keyof typeof devices.GamepadAxis,
    options: { positive?: boolean; } = {}
  ) {
    const finalizedAxisIndex = typeof axis === "string" ?
      devices.GamepadAxis[axis] : axis;

    const axisInfo = this.gamepad.axes[gamepad][finalizedAxisIndex];
    if (!axisInfo) {
      throw new Error("Invalid gamepad info");
    }

    return options.positive ?
      axisInfo.wasPositiveJustReleased :
      axisInfo.wasNegativeJustReleased;
  }

  getGamepadAxisValue(
    gamepad: devices.GamepadIndex,
    axis: number | keyof typeof devices.GamepadAxis
  ) {
    const finalizedAxisIndex = typeof axis === "string" ?
      devices.GamepadAxis[axis] : axis;

    if (!this.gamepad.axes[gamepad][finalizedAxisIndex]) {
      throw new Error("Invalid gamepad info");
    }

    return this.gamepad.axes[gamepad][finalizedAxisIndex].value;
  }

  getGamepadButtonValue(
    gamepad: devices.GamepadIndex,
    buttonIndex: number | keyof typeof devices.GamepadButton
  ): number {
    const finalizedButtonIndex = typeof buttonIndex === "string" ?
      devices.GamepadButton[buttonIndex] : buttonIndex;

    if (!this.gamepad.buttons[gamepad][finalizedButtonIndex]) {
      throw new Error("Invalid gamepad info");
    }

    return this.gamepad.buttons[gamepad][finalizedButtonIndex].value;
  }

  private onBlur = () => {
    this.#sourceInputs()
      .forEach((subscriber) => subscriber.reset());
  };

  private onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
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

export type {
  InputMouseAction,
  InputKeyboardAction,
  InputCustomAction
};
