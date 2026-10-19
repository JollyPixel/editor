// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  type NavigatorAdapter,
  BrowserNavigatorAdapter,
  type WindowAdapter,
  BrowserWindowAdapter
} from "../../adapters/index.ts";
import type {
  InputControl,
  InputReader
} from "../../types.ts";
import { GamepadVibration } from "./GamepadVibration.class.ts";
import {
  GamepadSlot,
  type GamepadTuning
} from "./GamepadSlot.ts";

export type GamepadIndex = 0 | 1 | 2 | 3;

export const GamepadButton = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,

  LeftBumper: 4,
  RightBumper: 5,
  LeftTrigger: 6,
  RightTrigger: 7,

  Select: 8,
  Start: 9,

  LeftStick: 10,
  RightStick: 11,

  DPadUp: 12,
  DPadDown: 13,
  DPadLeft: 14,
  DPadRight: 15,

  Home: 16
} as const;

export const GamepadAxis = {
  LeftStickX: 0,
  LeftStickY: 1,
  RightStickX: 2,
  RightStickY: 3
} as const;

export type GamepadEvents = {
  connect: (gamepad: globalThis.Gamepad) => void;
  disconnect: (gamepad: globalThis.Gamepad) => void;
};

export interface GamepadOptions {
  navigatorAdapter?: NavigatorAdapter;
  windowAdapter?: WindowAdapter;
}

export class Gamepad extends Emitter<
  GamepadEvents
> implements InputControl, GamepadTuning {
  static readonly MaxGamepads = 4;
  static readonly MaxButtons = 17;
  static readonly MaxAxes = 4;
  static IdlePollFrames = 30;

  #navigatorAdapter: NavigatorAdapter;
  #windowAdapter: WindowAdapter;

  #connectedGamepads = 0;
  #wasActive = false;
  #idlePollCountdown = 0;
  #presentGamepads = 0;
  #slots: GamepadSlot[] = [];

  readonly vibration: GamepadVibration[] = [];

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
    for (let index = 0; index < Gamepad.MaxGamepads; index++) {
      this.#slots.push(
        new GamepadSlot(
          Gamepad.MaxButtons,
          Gamepad.MaxAxes
        )
      );
      this.vibration.push(new GamepadVibration());
    }
  }

  get connectedGamepads(): number {
    return this.#connectedGamepads;
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
    this.#wasActive = false;
    for (const slot of this.#slots) {
      slot.reset();
    }
  }

  isButtonDown(
    gamepad: GamepadIndex,
    button: number | keyof typeof GamepadButton
  ): boolean {
    return this.#slot(gamepad).isButtonDown(
      Gamepad.#buttonIndex(button)
    );
  }

  wasButtonJustPressed(
    gamepad: GamepadIndex,
    button: number | keyof typeof GamepadButton
  ): boolean {
    return this.#slot(gamepad).wasButtonPressed(
      Gamepad.#buttonIndex(button)
    );
  }

  wasButtonJustReleased(
    gamepad: GamepadIndex,
    button: number | keyof typeof GamepadButton
  ): boolean {
    return this.#slot(gamepad).wasButtonReleased(
      Gamepad.#buttonIndex(button)
    );
  }

  buttonValue(
    gamepad: GamepadIndex,
    button: number | keyof typeof GamepadButton
  ): number {
    return this.#slot(gamepad).buttonValue(
      Gamepad.#buttonIndex(button)
    );
  }

  wasAxisJustPressed(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis,
    options: {
      autoRepeat?: boolean; positive?: boolean;
    } = {}
  ): boolean {
    const {
      autoRepeat = false,
      positive = false
    } = options;

    return this.#slot(gamepad).wasAxisPressed(
      Gamepad.#axisIndex(axis),
      positive,
      autoRepeat
    );
  }

  wasAxisJustReleased(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis,
    options: { positive?: boolean; } = {}
  ): boolean {
    return this.#slot(gamepad).wasAxisReleased(
      Gamepad.#axisIndex(axis),
      options.positive ?? false
    );
  }

  axisValue(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis
  ): number {
    return this.#slot(gamepad).axisValue(
      Gamepad.#axisIndex(axis)
    );
  }

  update() {
    this.sample();
    this.publish("step");
  }

  publish(
    reader: InputReader
  ): void {
    if (this.#presentGamepads === 0) {
      return;
    }

    for (const slot of this.#slots) {
      slot.publish(reader);
    }
  }

  sample(): void {
    if (
      this.#presentGamepads === 0 &&
      this.#connectedGamepads <= 0
    ) {
      if (this.#idlePollCountdown > 0) {
        this.#idlePollCountdown--;

        return;
      }

      this.#idlePollCountdown = Gamepad.IdlePollFrames;
    }

    const gamepads = this.#navigatorAdapter.getGamepads();
    let present = 0;
    let active = false;
    for (let index = 0; index < Gamepad.MaxGamepads; index++) {
      const gamepad = gamepads?.[index];
      if (gamepad) {
        present |= 1 << index;
        this.#slots[index].sample(gamepad, this);
        active ||= this.#slots[index].active;
        this.vibration[index].actuator = gamepad.vibrationActuator ?? null;
      }
      else if ((this.#presentGamepads & (1 << index)) !== 0) {
        this.#slots[index].reset();
      }
    }
    this.#presentGamepads = present;
    this.#wasActive = active;
  }

  #slot(
    gamepad: GamepadIndex
  ): GamepadSlot {
    return this.#slots[
      Gamepad.#index(gamepad, Gamepad.MaxGamepads)
    ];
  }

  #onGamepadConnected = (event: GamepadEvent) => {
    this.#connectedGamepads++;
    this.#idlePollCountdown = 0;
    this.emit("connect", event.gamepad);
  };

  #onGamepadDisconnected = (event: GamepadEvent) => {
    this.#connectedGamepads = Math.max(
      0,
      this.#connectedGamepads - 1
    );
    this.emit("disconnect", event.gamepad);
  };

  static #buttonIndex(
    button: number | keyof typeof GamepadButton
  ): number {
    return Gamepad.#index(
      typeof button === "string" ? GamepadButton[button] : button,
      Gamepad.MaxButtons
    );
  }

  static #axisIndex(
    axis: number | keyof typeof GamepadAxis
  ): number {
    return Gamepad.#index(
      typeof axis === "string" ? GamepadAxis[axis] : axis,
      Gamepad.MaxAxes
    );
  }

  static #index(
    index: number,
    count: number
  ): number {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= count
    ) {
      throw new Error("Invalid gamepad info");
    }

    return index;
  }
}
