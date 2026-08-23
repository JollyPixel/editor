// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import * as devices from "./devices/index.ts";
import {
  BrowserWindowAdapter,
  type CanvasAdapter,
  type WindowAdapter
} from "./adapters/index.ts";
import type {
  InputControl,
  KeyCode
} from "./types.ts";

/**
 * @note default stand for mouse + keyboard
 */
export type InputDevicePreference = "default" | "gamepad";

/**
 * Dot-path names for every event emitted across `Input` and its devices
 */
export type InputListenerType =
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

export type InputEvents = {
  exit: () => void;
  devicePreferenceChange: (
    preference: InputDevicePreference
  ) => void;
};

export interface InputOptions {
  /**
   * @default false
   */
  enableOnExit?: boolean;
  windowAdapter?: WindowAdapter;
}

export class Input extends Emitter<InputEvents> {
  #windowAdapter: WindowAdapter;
  #preference: InputDevicePreference = "default";

  mouse: devices.Mouse;
  touchpad: devices.Touchpad;
  gamepad: devices.Gamepad;
  screen: devices.Screen;
  keyboard: devices.Keyboard;

  exited = false;

  constructor(
    canvas: CanvasAdapter,
    options: InputOptions = {}
  ) {
    super();
    const {
      enableOnExit = false,
      windowAdapter = new BrowserWindowAdapter()
    } = options;

    this.#windowAdapter = windowAdapter;
    const fullscreen = new devices.Screen({
      canvas
    });
    this.mouse = new devices.Mouse({
      canvas
    });
    this.mouse.on("down", fullscreen.requestFullscreenIfWanted);
    this.mouse.on("up", fullscreen.requestFullscreenIfWanted);

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
      this.#windowAdapter.onbeforeunload = this.#doExitCallback;
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
    this.#windowAdapter.addEventListener(
      "blur",
      this.#onBlur
    );
    this.#windowAdapter.addEventListener(
      "contextmenu",
      this.#onContextMenu
    );
  }

  disconnect() {
    [...this.#sourceInputs(), this.screen]
      .forEach((subscriber) => subscriber.disconnect?.());
    this.#windowAdapter.removeEventListener(
      "blur",
      this.#onBlur
    );
    this.#windowAdapter.removeEventListener(
      "contextmenu",
      this.#onContextMenu
    );
  }

  get devicePreference(): InputDevicePreference {
    return this.#preference;
  }

  update() {
    this.#sourceInputs()
      .forEach((subscriber) => subscriber.update());

    if (
      this.gamepad.wasActive &&
      this.#preference !== "gamepad"
    ) {
      this.#preference = "gamepad";
      this.emit(
        "devicePreferenceChange",
        this.#preference
      );
    }
    else if (
      this.#preference !== "default" &&
      (this.keyboard.wasActive || this.mouse.wasActive || this.touchpad.wasActive)
    ) {
      this.#preference = "default";
      this.emit(
        "devicePreferenceChange",
        this.#preference
      );
    }
  }

  vibrate(
    pattern: VibratePattern
  ): void {
    this.#windowAdapter.navigator.vibrate(pattern);
  }

  #onBlur = () => {
    this.#sourceInputs()
      .forEach((subscriber) => subscriber.reset());
  };

  #onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  #doExitCallback = () => {
    if (!this.exited) {
      this.emit("exit");
    }
    this.exited = true;
  };
}
