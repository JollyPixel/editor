/* eslint-disable max-params */
// Import Third-party Dependencies
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import {
  type NavigatorAdapter,
  BrowserNavigatorAdapter,
  type WindowAdapter,
  BrowserWindowAdapter
} from "../../adapters/index.ts";
import type { InputControl } from "../types.ts";

export type GamepadIndex = 0 | 1 | 2 | 3;

/**
 * Standard Gamepad button mapping (W3C Gamepad API specification).
 *
 * This mapping corresponds to a typical Xbox/PlayStation controller layout.
 * Actual button availability may vary by controller model.
 *
 * @see https://w3c.github.io/gamepad/#remapping
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/buttons
 */
export const GamepadButton = {
  // Face buttons (right side)
  // Bottom button (Xbox: A, PlayStation: Cross)
  A: 0,
  // Right button (Xbox: B, PlayStation: Circle)
  B: 1,
  // Left button (Xbox: X, PlayStation: Square)
  X: 2,
  // Top button (Xbox: Y, PlayStation: Triangle)
  Y: 3,

  // Shoulder buttons
  // L1
  LeftBumper: 4,
  // R1
  RightBumper: 5,
  // L2
  LeftTrigger: 6,
  // R2
  RightTrigger: 7,

  // Center buttons
  // Back/Share button
  Select: 8,
  // Start/Options button
  Start: 9,

  // Stick buttons (press down on analog stick)
  // L3
  LeftStick: 10,
  // R3
  RightStick: 11,

  // D-Pad
  DPadUp: 12,
  DPadDown: 13,
  DPadLeft: 14,
  DPadRight: 15,

  // Special buttons (may not be present on all controllers)
  // Xbox and PlayStation button
  Home: 16
} as const;

/**
 * Standard Gamepad axis mapping.
 *
 * Axis values range from -1.0 to 1.0.
 * - Negative values: Left/Up
 * - Positive values: Right/Down
 */
export const GamepadAxis = {
  LeftStickX: 0,
  LeftStickY: 1,
  RightStickX: 2,
  RightStickY: 3
} as const;

export interface GamepadButtonState {
  isDown: boolean;
  wasJustPressed: boolean;
  wasJustReleased: boolean;
  value: number;
}

export interface GamepadAxisState {
  wasPositiveJustPressed: boolean;
  wasPositiveJustAutoRepeated: boolean;
  wasPositiveJustReleased: boolean;
  wasNegativeJustPressed: boolean;
  wasNegativeJustAutoRepeated: boolean;
  wasNegativeJustReleased: boolean;
  value: number;
}

export interface GamepadAutoRepeat {
  axis: number;
  positive: boolean;
  time: number;
}

interface AxisDownState {
  positive: boolean;
  negative: boolean;
}

export type GamepadEvents = {
  connect: [gamepad: globalThis.Gamepad];
  disconnect: [gamepad: globalThis.Gamepad];
};

export interface GamepadOptions {
  navigatorAdapter?: NavigatorAdapter;
  windowAdapter?: WindowAdapter;
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
 */
export class Gamepad extends EventEmitter<GamepadEvents> implements InputControl {
  static MaxGamepads = 4;
  static MaxButtons = 16;
  static MaxAxes = 4;

  #navigatorAdapter: NavigatorAdapter;
  #windowAdapter: WindowAdapter;

  #wasActive = false;
  connectedGamepads = 0;
  buttons: GamepadButtonState[][] = [];
  axes: GamepadAxisState[][] = [];
  autoRepeats: (GamepadAutoRepeat | null)[] = [];

  axisDeadZone = 0.25;
  axisAutoRepeatDelayMs = 500;
  axisAutoRepeatRateMs = 33;

  constructor(
    options: GamepadOptions = {}
  ) {
    super();
    const {
      navigatorAdapter = new BrowserNavigatorAdapter(),
      windowAdapter = new BrowserWindowAdapter()
    } = options;

    this.#navigatorAdapter = navigatorAdapter;
    this.#windowAdapter = windowAdapter;
    for (let gamepadIndex = 0; gamepadIndex < Gamepad.MaxGamepads; gamepadIndex++) {
      this.buttons[gamepadIndex] = [];
      this.axes[gamepadIndex] = [];
      this.autoRepeats[gamepadIndex] = null;
    }

    this.reset();
  }

  get wasActive() {
    return this.#wasActive;
  }

  connect(): void {
    this.#windowAdapter.addEventListener("gamepadconnected", this.onGamepadConnected);
    this.#windowAdapter.addEventListener("gamepaddisconnected", this.onGamepadDisconnected);
  }

  disconnect(): void {
    this.#windowAdapter.removeEventListener("gamepadconnected", this.onGamepadConnected);
    this.#windowAdapter.removeEventListener("gamepaddisconnected", this.onGamepadDisconnected);
  }

  reset() {
    for (let gamepadIndex = 0; gamepadIndex < Gamepad.MaxGamepads; gamepadIndex++) {
      for (let button = 0; button < Gamepad.MaxButtons; button++) {
        this.buttons[gamepadIndex][button] = {
          isDown: false,
          wasJustPressed: false,
          wasJustReleased: false,
          value: 0
        };
      }
      for (let axes = 0; axes < Gamepad.MaxAxes; axes++) {
        this.axes[gamepadIndex][axes] = {
          wasPositiveJustPressed: false,
          wasPositiveJustAutoRepeated: false,
          wasPositiveJustReleased: false,
          wasNegativeJustPressed: false,
          wasNegativeJustAutoRepeated: false,
          wasNegativeJustReleased: false,
          value: 0
        };
      }
    }
  }

  update() {
    const gamepads = this.#navigatorAdapter.getGamepads();
    if (gamepads === null) {
      return;
    }

    this.#wasActive = false;
    for (let gamepadIndex = 0; gamepadIndex < Gamepad.MaxGamepads; gamepadIndex++) {
      const gamepad = gamepads[gamepadIndex];
      if (gamepad) {
        this.#updateButtons(gamepad, gamepadIndex);
        this.#updateAxes(gamepad, gamepadIndex);
      }
    }
  }

  #updateButtons(
    gamepad: globalThis.Gamepad,
    gamepadIndex: number
  ): void {
    for (let buttonIndex = 0; buttonIndex < this.buttons[gamepadIndex].length; buttonIndex++) {
      if (gamepad.buttons[buttonIndex] === null) {
        continue;
      }

      const button = this.buttons[gamepadIndex][buttonIndex];
      const wasDown = button.isDown;
      const isDown = gamepad.buttons[buttonIndex].pressed;

      button.isDown = isDown;
      button.value = gamepad.buttons[buttonIndex].value;
      button.wasJustPressed = !wasDown && button.isDown;
      button.wasJustReleased = wasDown && !button.isDown;

      if (isDown) {
        this.#wasActive = true;
      }
    }
  }

  #updateAxes(
    gamepad: globalThis.Gamepad,
    gamepadIndex: number
  ): void {
    const now = Date.now();

    for (let stick = 0; stick < 2; stick++) {
      const stickIndex = stick * 2;
      if (!(gamepad.axes[stickIndex] !== null &&
        gamepad.axes[stickIndex + 1] !== null)) {
        continue;
      }

      const axes: [GamepadAxisState, GamepadAxisState] = [
        this.axes[gamepadIndex][stickIndex],
        this.axes[gamepadIndex][stickIndex + 1]
      ];

      const wasAxisDown = this.#getAxisDownStates(axes);
      this.#updateAxisValues(gamepad, axes, stickIndex);
      const isAxisDown = this.#getAxisDownStates(axes);

      this.#updateAxisStates(axes, wasAxisDown, isAxisDown);
      this.#processCurrentAutoRepeat(gamepadIndex, stickIndex, axes, isAxisDown, now);
      this.#createNewAutoRepeat(gamepadIndex, stickIndex, axes, now);

      if (
        isAxisDown[0].positive || isAxisDown[0].negative ||
        isAxisDown[1].positive || isAxisDown[1].negative
      ) {
        this.#wasActive = true;
      }
    }
  }

  #getAxisDownStates(
    axes: [GamepadAxisState, GamepadAxisState]
  ): [AxisDownState, AxisDownState] {
    const pressedValue = 0.5;

    return [
      { positive: axes[0].value > pressedValue, negative: axes[0].value < -pressedValue },
      { positive: axes[1].value > pressedValue, negative: axes[1].value < -pressedValue }
    ];
  }

  #updateAxisValues(
    gamepad: globalThis.Gamepad,
    axes: [GamepadAxisState, GamepadAxisState],
    stickIndex: number
  ): void {
    const axisLength = Math.sqrt(
      Math.pow(Math.abs(gamepad.axes[stickIndex]), 2) +
      Math.pow(Math.abs(gamepad.axes[stickIndex + 1]), 2)
    );

    if (axisLength < this.axisDeadZone) {
      axes[0].value = 0;
      axes[1].value = 0;
    }
    else {
      axes[0].value = gamepad.axes[stickIndex];
      axes[1].value = gamepad.axes[stickIndex + 1];
    }
  }

  #updateAxisStates(
    axes: GamepadAxisState[],
    wasAxisDown: Array<AxisDownState>,
    isAxisDown: Array<AxisDownState>
  ): void {
    for (let i = 0; i < 2; i++) {
      const axis = axes[i];

      axis.wasPositiveJustPressed = !wasAxisDown[i].positive && isAxisDown[i].positive;
      axis.wasPositiveJustReleased = wasAxisDown[i].positive && !isAxisDown[i].positive;
      axis.wasPositiveJustAutoRepeated = false;

      axis.wasNegativeJustPressed = !wasAxisDown[i].negative && isAxisDown[i].negative;
      axis.wasNegativeJustReleased = wasAxisDown[i].negative && !isAxisDown[i].negative;
      axis.wasNegativeJustAutoRepeated = false;
    }
  }

  #processCurrentAutoRepeat(
    gamepadIndex: number,
    stick: number,
    axes: GamepadAxisState[],
    isAxisDown: Array<AxisDownState>,
    now: number
  ): void {
    const currentAutoRepeat = this.autoRepeats[gamepadIndex];
    if (currentAutoRepeat === null) {
      return;
    }

    const axisIndex = currentAutoRepeat.axis - (stick * 2);
    if (axisIndex !== 0 && axisIndex !== 1) {
      return;
    }

    const shouldReleaseAutoRepeat =
      (currentAutoRepeat.positive && !isAxisDown[axisIndex].positive) ||
      (!currentAutoRepeat.positive && !isAxisDown[axisIndex].negative);

    if (shouldReleaseAutoRepeat) {
      this.autoRepeats[gamepadIndex] = null;
    }
    else if (currentAutoRepeat.time <= now) {
      const autoRepeatedAxis = axes[axisIndex];
      if (currentAutoRepeat.positive) {
        autoRepeatedAxis.wasPositiveJustAutoRepeated = true;
      }
      else {
        autoRepeatedAxis.wasNegativeJustAutoRepeated = true;
      }
      currentAutoRepeat.time = now + this.axisAutoRepeatRateMs;
    }
  }

  #createNewAutoRepeat(
    gamepadIndex: number,
    stick: number,
    axes: GamepadAxisState[],
    now: number
  ): void {
    let newAutoRepeat: GamepadAutoRepeat | null = null;

    if (
      axes[0].wasPositiveJustPressed ||
      axes[0].wasNegativeJustPressed
    ) {
      newAutoRepeat = {
        axis: stick * 2,
        positive: axes[0].wasPositiveJustPressed,
        time: now + this.axisAutoRepeatDelayMs
      };
    }
    else if (
      axes[1].wasPositiveJustPressed ||
      axes[1].wasNegativeJustPressed
    ) {
      newAutoRepeat = {
        axis: (stick * 2) + 1,
        positive: axes[1].wasPositiveJustPressed,
        time: now + this.axisAutoRepeatDelayMs
      };
    }

    const currentAutoRepeat = this.autoRepeats[gamepadIndex];
    const shouldSetNewAutoRepeat =
      newAutoRepeat !== null &&
      (currentAutoRepeat === null ||
        currentAutoRepeat.axis !== newAutoRepeat.axis ||
        currentAutoRepeat.positive !== newAutoRepeat.positive);

    if (shouldSetNewAutoRepeat) {
      this.autoRepeats[gamepadIndex] = newAutoRepeat;
    }
  }

  private onGamepadConnected = (event: GamepadEvent) => {
    this.connectedGamepads++;
    this.emit("connect", event.gamepad);
  };

  private onGamepadDisconnected = (event: GamepadEvent) => {
    this.connectedGamepads--;
    this.emit("disconnect", event.gamepad);
  };
}
