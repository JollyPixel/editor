// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import * as targets from "./targets/index.js";

export type { MouseEventButton } from "./targets/Mouse.class.js";

export interface InputOptions {
  /**
   * @default false
   */
  enableOnExit?: boolean;
}

export type InputMouseAction =
  | number
  | keyof typeof targets.MouseEventButton
  | "ANY"
  | "NONE";

export type InputKeyboardAction = string | "ANY" | "NONE";

export class Input extends EventTarget {
  #canvas: HTMLCanvasElement;

  mouse: targets.Mouse;
  touchpad: targets.Touchpad;
  gamepad: targets.Gamepad;
  fullscreen: targets.Fullscreen | null;
  keyboard: targets.Keyboard;

  exited = false;

  constructor(
    canvas: HTMLCanvasElement,
    options: InputOptions = {}
  ) {
    super();
    const {
      enableOnExit = false
    } = options;

    this.#canvas = canvas;
    const fullscreen = new targets.Fullscreen(canvas);
    this.mouse = new targets.Mouse(canvas, {
      mouseDownCallback: () => fullscreen.onMouseDown(),
      mouseUpCallback: () => fullscreen.onMouseUp()
    });
    this.fullscreen = fullscreen;
    this.touchpad = new targets.Touchpad(this.mouse);
    this.gamepad = new targets.Gamepad();
    this.keyboard = new targets.Keyboard();

    if (enableOnExit) {
      window.onbeforeunload = this.doExitCallback;
    }
  }

  #targets() {
    return [
      this.mouse,
      this.touchpad,
      this.keyboard,
      this.gamepad
    ];
  }

  connect() {
    this.#targets()
      .forEach((subscriber) => subscriber.connect());
    this.fullscreen?.connect();
    window.addEventListener("blur", this.onBlur);
  }

  disconnect() {
    this.#targets()
      .forEach((subscriber) => subscriber.disconnect());
    this.fullscreen?.disconnect();
    window.removeEventListener("blur", this.onBlur);
  }

  update() {
    this.#targets()
      .forEach((subscriber) => subscriber?.update());
  }

  getScreenSize() {
    return new THREE.Vector2(this.#canvas.clientWidth, this.#canvas.clientHeight);
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

    const index = typeof action === "number" ? action : targets.MouseEventButton[action];

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

    const index = typeof action === "number" ? action : targets.MouseEventButton[action];

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
    const index = typeof action === "number" ? action : targets.MouseEventButton[action];

    return this.mouse.buttons[index]?.wasJustPressed ?? false;
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

  vibrate(
    pattern: VibratePattern
  ): void {
    window.navigator.vibrate(pattern);
  }

  private onBlur = () => {
    this.#targets()
      .forEach((subscriber) => subscriber.reset());
  };

  private doExitCallback = () => {
    // NOTE: It seems window.onbeforeunload might be called twice
    // in some circumstances so we check if the callback was cleared already
    // http://stackoverflow.com/questions/8711393/onbeforeunload-fires-twice
    if (!this.exited) {
      this.dispatchEvent(new CustomEvent("exit"));
    }
    this.exited = true;
  };
}
