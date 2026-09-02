// Import Internal Dependencies
import type { Input } from "../../Input.class.ts";
import type {
  GamepadAxis,
  GamepadIndex
} from "../../devices/index.ts";
import type { AxisSource } from "./AxisSource.ts";

export interface GamepadAxisSourceOptions {
  invert?: boolean;
}

export class GamepadAxisSource implements AxisSource {
  #gamepad: GamepadIndex;
  #axis: number | keyof typeof GamepadAxis;
  #sign: number;

  constructor(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis,
    options: GamepadAxisSourceOptions = {}
  ) {
    const { invert = false } = options;

    this.#gamepad = gamepad;
    this.#axis = axis;
    this.#sign = invert ? -1 : 1;
  }

  sample(
    input: Input
  ): number {
    return input.gamepad.axisValue(
      this.#gamepad,
      this.#axis
    ) * this.#sign;
  }

  reset(): void {
    return void 0;
  }
}
