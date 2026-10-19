// Import Internal Dependencies
import type { InputReader } from "../../types.ts";
import { ControlBank } from "../ControlBank.ts";

// CONSTANTS
const kAxisPressedValue = 0.5;
const kStickCount = 2;

export interface GamepadTuning {
  axisDeadZone: number;
  axisAutoRepeatDelayMs: number;
  axisAutoRepeatRateMs: number;
}

interface AxisAutoRepeat {
  direction: number;
  time: number;
}

export class GamepadSlot {
  readonly buttonCount: number;
  readonly axisCount: number;

  #controls = new ControlBank<number>();
  #buttonValues: number[];
  #axisValues: number[];
  #autoRepeat: AxisAutoRepeat | null = null;

  constructor(
    buttonCount: number,
    axisCount: number
  ) {
    this.buttonCount = buttonCount;
    this.axisCount = axisCount;
    this.#buttonValues = Array.from({ length: buttonCount }, () => 0);
    this.#axisValues = Array.from({ length: axisCount }, () => 0);
  }

  get active(): boolean {
    return this.#controls.active;
  }

  isButtonDown(
    button: number
  ): boolean {
    return this.#controls.isDown(button);
  }

  wasButtonPressed(
    button: number
  ): boolean {
    return this.#controls.wasPressed(button);
  }

  wasButtonReleased(
    button: number
  ): boolean {
    return this.#controls.wasReleased(button);
  }

  buttonValue(
    button: number
  ): number {
    return this.#buttonValues[button];
  }

  axisValue(
    axis: number
  ): number {
    return this.#axisValues[axis];
  }

  wasAxisPressed(
    axis: number,
    positive: boolean,
    autoRepeat: boolean
  ): boolean {
    const direction = this.#direction(axis, positive);

    return this.#controls.wasPressed(direction) ||
      (autoRepeat && this.#controls.wasRepeated(direction));
  }

  wasAxisReleased(
    axis: number,
    positive: boolean
  ): boolean {
    return this.#controls.wasReleased(this.#direction(axis, positive));
  }

  sample(
    source: globalThis.Gamepad,
    tuning: GamepadTuning
  ): void {
    this.#sampleButtons(source);
    this.#sampleAxes(source, tuning.axisDeadZone);
    this.#sampleDirections(tuning);
    this.#controls.sample();
  }

  publish(
    reader: InputReader
  ): void {
    this.#controls.publish(reader);
  }

  reset(): void {
    this.#controls.reset();
    this.#buttonValues.fill(0);
    this.#axisValues.fill(0);
    this.#autoRepeat = null;
  }

  #direction(
    axis: number,
    positive: boolean
  ): number {
    return this.buttonCount + (axis * 2) + Number(!positive);
  }

  #sampleButtons(
    source: globalThis.Gamepad
  ): void {
    const count = Math.min(this.buttonCount, source.buttons.length);
    for (let button = 0; button < count; button++) {
      const state = source.buttons[button];
      if (!state) {
        continue;
      }

      this.#buttonValues[button] = state.value;
      this.#controls.follow(button, state.pressed);
    }
  }

  #sampleAxes(
    source: globalThis.Gamepad,
    deadZone: number
  ): void {
    for (let stick = 0; stick < kStickCount; stick++) {
      const axis = stick * 2;
      const x = source.axes[axis];
      const y = source.axes[axis + 1];
      if (typeof x !== "number" || typeof y !== "number") {
        continue;
      }

      const live = Number((x * x) + (y * y) >= deadZone * deadZone);
      this.#axisValues[axis] = x * live;
      this.#axisValues[axis + 1] = y * live;
    }
  }

  #sampleDirections(
    tuning: GamepadTuning
  ): void {
    let pressed: number | null = null;
    for (let axis = 0; axis < this.axisCount; axis++) {
      const value = this.#axisValues[axis];
      const positive = this.#direction(axis, true);
      const negative = this.#direction(axis, false);
      const pressedPositive = this.#controls.follow(
        positive,
        value > kAxisPressedValue
      );
      const pressedNegative = this.#controls.follow(
        negative,
        value < -kAxisPressedValue
      );
      if (pressed === null && (pressedPositive || pressedNegative)) {
        pressed = pressedPositive ? positive : negative;
      }
    }

    const now = Date.now();
    const current = this.#autoRepeat;
    if (current !== null) {
      if (!this.#controls.isDown(current.direction)) {
        this.#autoRepeat = null;
      }
      else if (current.time <= now) {
        this.#controls.repeat(current.direction);
        current.time = now + tuning.axisAutoRepeatRateMs;
      }
    }
    if (pressed !== null) {
      this.#autoRepeat = {
        direction: pressed,
        time: now + tuning.axisAutoRepeatDelayMs
      };
    }
  }
}
