// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import * as devices from "./devices/index.ts";
import {
  BrowserWindowAdapter,
  BrowserDocumentAdapter,
  type CanvasAdapter,
  type DocumentAdapter,
  type WindowAdapter
} from "./adapters/index.ts";
import type {
  InputControl,
  InputReader,
  KeyCode
} from "./types.ts";

export type InputDevicePreference = "default" | "gamepad";

export type InputListenerType =
  | "input.devicePreferenceChange"
  | "input.exit"
  | "mouse.down"
  | "mouse.up"
  | "mouse.move"
  | "mouse.wheel"
  | "mouse.enter"
  | "mouse.leave"
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
  documentAdapter?: DocumentAdapter;
}

export class Input extends Emitter<InputEvents> {
  #windowAdapter: WindowAdapter;
  #preference: InputDevicePreference = "default";
  #controls: readonly InputControl[];

  readonly mouse: devices.Mouse;
  readonly touchpad: devices.Touchpad;
  readonly gamepad: devices.Gamepad;
  readonly screen: devices.Screen;
  readonly keyboard: devices.Keyboard;

  exited = false;

  constructor(
    canvas: CanvasAdapter,
    options: InputOptions = {}
  ) {
    super();
    const {
      enableOnExit = false,
      windowAdapter = new BrowserWindowAdapter(),
      documentAdapter = new BrowserDocumentAdapter()
    } = options;

    this.#windowAdapter = windowAdapter;
    this.screen = new devices.Screen({
      canvas,
      documentAdapter
    });
    this.mouse = new devices.Mouse({
      canvas,
      documentAdapter
    });
    this.touchpad = new devices.Touchpad({
      canvas
    });
    this.gamepad = new devices.Gamepad({
      navigatorAdapter: this.#windowAdapter.navigator,
      windowAdapter: this.#windowAdapter
    });
    this.keyboard = new devices.Keyboard({
      documentAdapter
    });
    this.#controls = [
      this.mouse,
      this.touchpad,
      this.keyboard,
      this.gamepad
    ];

    if (enableOnExit) {
      this.#windowAdapter.onbeforeunload = this.#doExitCallback;
    }
  }

  connect() {
    for (const control of this.#controls) {
      control.connect();
    }
    this.screen.connect();
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
    for (const control of this.#controls) {
      control.disconnect();
    }
    this.screen.disconnect();
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

  get wasActive(): boolean {
    for (const control of this.#controls) {
      if (control.wasActive) {
        return true;
      }
    }

    return false;
  }

  update() {
    this.sample();
    this.publish("step");
  }

  sample(): void {
    for (const control of this.#controls) {
      control.sample();
    }
    this.#updatePreference();
  }

  publish(
    reader: InputReader
  ): void {
    for (const control of this.#controls) {
      control.publish(reader);
    }
  }

  #updatePreference(): void {
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
    for (const control of this.#controls) {
      control.reset();
    }
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
