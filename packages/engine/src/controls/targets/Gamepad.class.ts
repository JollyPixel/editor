/* eslint-disable max-params */
// Import Internal Dependencies
import {
  type NavigatorAdapter,
  BrowserNavigatorAdapter
} from "../../adapters/navigator.js";
import type { InputControl } from "../types.js";

export type GamepadIndex = 0 | 1 | 2 | 3;

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

export interface GamepadOptions {
  navigatorAdapter?: NavigatorAdapter;
}

export class Gamepad implements InputControl {
  #navigatorAdapter: NavigatorAdapter;

  static maxTouches = 10;

  buttons: GamepadButtonState[][] = [];
  axes: GamepadAxisState[][] = [];
  autoRepeats: (GamepadAutoRepeat | null)[] = [];

  axisDeadZone = 0.25;
  axisAutoRepeatDelayMs = 500;
  axisAutoRepeatRateMs = 33;

  constructor(
    options: GamepadOptions = {}
  ) {
    const {
      navigatorAdapter = new BrowserNavigatorAdapter()
    } = options;

    this.#navigatorAdapter = navigatorAdapter;
    for (let i = 0; i < 4; i++) {
      this.buttons[i] = [];
      this.axes[i] = [];
      this.autoRepeats[i] = null;
    }

    this.reset();
  }

  reset() {
    for (let i = 0; i < 4; i++) {
      for (let button = 0; button < 16; button++) {
        this.buttons[i][button] = {
          isDown: false,
          wasJustPressed: false,
          wasJustReleased: false,
          value: 0
        };
      }
      for (let axes = 0; axes < 4; axes++) {
        this.axes[i][axes] = {
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

    for (let index = 0; index < 4; index++) {
      const gamepad = gamepads[index];
      if (gamepad) {
        this.#updateButtons(gamepad, index);
        this.#updateAxes(gamepad, index);
      }
    }
  }

  #updateButtons(
    gamepad: globalThis.Gamepad,
    gamepadIndex: number
  ): void {
    for (let i = 0; i < this.buttons[gamepadIndex].length; i++) {
      if (gamepad.buttons[i] === null) {
        continue;
      }

      const button = this.buttons[gamepadIndex][i];
      const wasDown = button.isDown;

      button.isDown = gamepad.buttons[i].pressed;
      button.value = gamepad.buttons[i].value;
      button.wasJustPressed = !wasDown && button.isDown;
      button.wasJustReleased = wasDown && !button.isDown;
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
}
