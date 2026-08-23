// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  type NavigatorAdapter,
  BrowserNavigatorAdapter,
  type WindowAdapter,
  BrowserWindowAdapter
} from "./../adapters/index.ts";
import type { InputControl } from "../types.ts";
import { GamepadVibration } from "./GamepadVibration.class.ts";

// CONSTANTS
/** Deflection past which a stick axis counts as "pressed" in a direction. */
const kAxisPressedValue = 0.5;

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
  connect: (gamepad: globalThis.Gamepad) => void;
  disconnect: (gamepad: globalThis.Gamepad) => void;
};

export interface GamepadOptions {
  navigatorAdapter?: NavigatorAdapter;
  windowAdapter?: WindowAdapter;
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
 */
export class Gamepad extends Emitter<GamepadEvents> implements InputControl {
  static MaxGamepads = 4;
  static MaxButtons = 16;
  static MaxAxes = 4;
  /**
   * Frames to wait between `getGamepads()` polls while nothing is connected.
   */
  static IdlePollFrames = 30;

  #navigatorAdapter: NavigatorAdapter;
  #windowAdapter: WindowAdapter;

  #wasActive = false;
  #idlePollCountdown = 0;
  #sawGamepad = false;

  /** Reused by `#updateAxes` to avoid per-stick allocations. */
  #stickScratch: [GamepadAxisState, GamepadAxisState] = [
    null as unknown as GamepadAxisState,
    null as unknown as GamepadAxisState
  ];
  #downScratch: [AxisDownState, AxisDownState] = [
    { positive: false, negative: false },
    { positive: false, negative: false }
  ];

  connectedGamepads = 0;
  buttons: GamepadButtonState[][] = [];
  axes: GamepadAxisState[][] = [];
  autoRepeats: (GamepadAutoRepeat | null)[] = [];
  vibration: GamepadVibration[] = [];

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
      this.vibration[gamepadIndex] = new GamepadVibration();
    }

    this.reset();
  }

  get wasActive() {
    return this.#wasActive;
  }

  connect(): void {
    this.#windowAdapter.addEventListener(
      "gamepadconnected",
      this.#onGamepadConnected
    );
    this.#windowAdapter.addEventListener(
      "gamepaddisconnected",
      this.#onGamepadDisconnected
    );
  }

  disconnect(): void {
    this.#windowAdapter.removeEventListener(
      "gamepadconnected",
      this.#onGamepadConnected
    );
    this.#windowAdapter.removeEventListener(
      "gamepaddisconnected",
      this.#onGamepadDisconnected
    );
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

  isButtonDown(
    gamepad: GamepadIndex,
    buttonIndex: number | keyof typeof GamepadButton
  ): boolean {
    return this.#resolveButton(gamepad, buttonIndex).isDown;
  }

  wasButtonJustPressed(
    gamepad: GamepadIndex,
    buttonIndex: number | keyof typeof GamepadButton
  ): boolean {
    return this.#resolveButton(gamepad, buttonIndex).wasJustPressed;
  }

  wasButtonJustReleased(
    gamepad: GamepadIndex,
    buttonIndex: number | keyof typeof GamepadButton
  ): boolean {
    return this.#resolveButton(gamepad, buttonIndex).wasJustReleased;
  }

  buttonValue(
    gamepad: GamepadIndex,
    buttonIndex: number | keyof typeof GamepadButton
  ): number {
    return this.#resolveButton(gamepad, buttonIndex).value;
  }

  wasAxisJustPressed(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis,
    options: { autoRepeat?: boolean; positive?: boolean; } = {}
  ): boolean {
    const axisInfo = this.#resolveAxis(gamepad, axis);
    const {
      autoRepeat = false,
      positive = false
    } = options;

    if (positive) {
      return axisInfo.wasPositiveJustPressed || (
        autoRepeat && axisInfo.wasPositiveJustAutoRepeated
      );
    }

    return axisInfo.wasNegativeJustPressed || (
      autoRepeat && axisInfo.wasNegativeJustAutoRepeated
    );
  }

  wasAxisJustReleased(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis,
    options: { positive?: boolean; } = {}
  ): boolean {
    const axisInfo = this.#resolveAxis(gamepad, axis);

    return options.positive ?
      axisInfo.wasPositiveJustReleased :
      axisInfo.wasNegativeJustReleased;
  }

  axisValue(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis
  ): number {
    return this.#resolveAxis(gamepad, axis).value;
  }

  #resolveButton(
    gamepad: GamepadIndex,
    buttonIndex: number | keyof typeof GamepadButton
  ): GamepadButtonState {
    const index = typeof buttonIndex === "string" ?
      GamepadButton[buttonIndex] : buttonIndex;

    const state = this.buttons[gamepad][index];
    if (!state) {
      throw new Error("Invalid gamepad info");
    }

    return state;
  }

  #resolveAxis(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis
  ): GamepadAxisState {
    const index = typeof axis === "string" ?
      GamepadAxis[axis] : axis;

    const state = this.axes[gamepad][index];
    if (!state) {
      throw new Error("Invalid gamepad info");
    }

    return state;
  }

  update() {
    // `gamepadconnected` may not fire for a controller present at page load.
    // Poll slowly until one is found, then resume per-frame polling.
    if (!this.#sawGamepad && this.connectedGamepads <= 0) {
      if (this.#idlePollCountdown > 0) {
        this.#idlePollCountdown--;
        this.#wasActive = false;

        return;
      }
      this.#idlePollCountdown = Gamepad.IdlePollFrames;
    }

    const gamepads = this.#navigatorAdapter.getGamepads();
    // Clear before early returns so device preference cannot remain stale.
    this.#wasActive = false;
    if (gamepads === null) {
      this.#sawGamepad = false;

      return;
    }

    let sawGamepad = false;
    for (let gamepadIndex = 0; gamepadIndex < Gamepad.MaxGamepads; gamepadIndex++) {
      const gamepad = gamepads[gamepadIndex];
      if (gamepad) {
        sawGamepad = true;
        this.#updateButtons(gamepad, gamepadIndex);
        this.#updateAxes(gamepad, gamepadIndex);
        this.vibration[gamepadIndex].actuator =
          gamepad.vibrationActuator ?? null;
      }
    }
    this.#sawGamepad = sawGamepad;
  }

  #updateButtons(
    gamepad: globalThis.Gamepad,
    gamepadIndex: number
  ): void {
    const states = this.buttons[gamepadIndex];
    // Controllers may expose fewer buttons than `MaxButtons`.
    const count = Math.min(states.length, gamepad.buttons.length);
    let active = 0;

    for (let buttonIndex = 0; buttonIndex < count; buttonIndex++) {
      const source = gamepad.buttons[buttonIndex];
      if (!source) {
        continue;
      }

      const button = states[buttonIndex];
      const wasDown = button.isDown;
      const isDown = source.pressed;

      button.isDown = isDown;
      button.value = source.value;
      button.wasJustPressed = !wasDown && isDown;
      button.wasJustReleased = wasDown && !isDown;

      active |= Number(isDown);
    }

    if (active !== 0) {
      this.#wasActive = true;
    }
  }

  #updateAxes(
    gamepad: globalThis.Gamepad,
    gamepadIndex: number
  ): void {
    const now = Date.now();

    for (let stick = 0; stick < 2; stick++) {
      const stickIndex = stick * 2;
      // Some controllers expose only one stick.
      if (
        typeof gamepad.axes[stickIndex] !== "number" ||
        typeof gamepad.axes[stickIndex + 1] !== "number"
      ) {
        continue;
      }

      const axes = this.#stickScratch;
      axes[0] = this.axes[gamepadIndex][stickIndex];
      axes[1] = this.axes[gamepadIndex][stickIndex + 1];

      const wasPositive0 = axes[0].value > kAxisPressedValue;
      const wasNegative0 = axes[0].value < -kAxisPressedValue;
      const wasPositive1 = axes[1].value > kAxisPressedValue;
      const wasNegative1 = axes[1].value < -kAxisPressedValue;

      this.#updateAxisValues(gamepad, axes, stickIndex);

      const isPositive0 = axes[0].value > kAxisPressedValue;
      const isNegative0 = axes[0].value < -kAxisPressedValue;
      const isPositive1 = axes[1].value > kAxisPressedValue;
      const isNegative1 = axes[1].value < -kAxisPressedValue;

      axes[0].wasPositiveJustPressed = !wasPositive0 && isPositive0;
      axes[0].wasPositiveJustReleased = wasPositive0 && !isPositive0;
      axes[0].wasPositiveJustAutoRepeated = false;
      axes[0].wasNegativeJustPressed = !wasNegative0 && isNegative0;
      axes[0].wasNegativeJustReleased = wasNegative0 && !isNegative0;
      axes[0].wasNegativeJustAutoRepeated = false;

      axes[1].wasPositiveJustPressed = !wasPositive1 && isPositive1;
      axes[1].wasPositiveJustReleased = wasPositive1 && !isPositive1;
      axes[1].wasPositiveJustAutoRepeated = false;
      axes[1].wasNegativeJustPressed = !wasNegative1 && isNegative1;
      axes[1].wasNegativeJustReleased = wasNegative1 && !isNegative1;
      axes[1].wasNegativeJustAutoRepeated = false;

      const down = this.#downScratch;
      down[0].positive = isPositive0;
      down[0].negative = isNegative0;
      down[1].positive = isPositive1;
      down[1].negative = isNegative1;

      this.#processCurrentAutoRepeat(
        gamepadIndex,
        stickIndex,
        axes,
        down,
        now
      );
      this.#createNewAutoRepeat(
        gamepadIndex,
        stickIndex,
        axes,
        now
      );

      if (isPositive0 || isNegative0 || isPositive1 || isNegative1) {
        this.#wasActive = true;
      }
    }
  }

  #updateAxisValues(
    gamepad: globalThis.Gamepad,
    axes: [GamepadAxisState, GamepadAxisState],
    stickIndex: number
  ): void {
    const x = gamepad.axes[stickIndex];
    const y = gamepad.axes[stickIndex + 1];

    // Compare squared magnitudes to avoid `sqrt`.
    const live = Number((x * x) + (y * y) >= this.axisDeadZone * this.axisDeadZone);

    axes[0].value = x * live;
    axes[1].value = y * live;
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

  #onGamepadConnected = (event: GamepadEvent) => {
    this.connectedGamepads++;
    // Cancel idle back-off so input is polled on the next frame.
    this.#idlePollCountdown = 0;
    this.emit("connect", event.gamepad);
  };

  #onGamepadDisconnected = (event: GamepadEvent) => {
    this.connectedGamepads = Math.max(0, this.connectedGamepads - 1);
    this.emit("disconnect", event.gamepad);
  };
}
