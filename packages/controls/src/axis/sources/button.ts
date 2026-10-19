// Import Internal Dependencies
import type { InputDevices } from "../../types.ts";
import {
  InputCombination,
  type CombinedKeyboardInputAction,
  type InputCondition
} from "../../combination/index.ts";
import type { InputKeyboardAction } from "../../devices/index.ts";
import type { AxisSource } from "./AxisSource.ts";

export type AxisHalf =
  | InputCondition
  | CombinedKeyboardInputAction
  | InputKeyboardAction
  | null;

export class ButtonAxisSource implements AxisSource {
  static #condition(
    half: AxisHalf
  ): InputCondition | null {
    if (half === null || typeof half !== "string") {
      return half;
    }

    return InputCombination.isCombinedAction(half) ?
      InputCombination.key(half) :
      InputCombination.key(half, "down");
  }

  #positive: InputCondition | null;
  #negative: InputCondition | null;

  constructor(
    positive: AxisHalf,
    negative: AxisHalf
  ) {
    this.#positive = ButtonAxisSource.#condition(positive);
    this.#negative = ButtonAxisSource.#condition(negative);
  }

  sample(
    input: InputDevices
  ): number {
    let value = 0;

    if (
      this.#positive !== null &&
      this.#positive.evaluate(input)
    ) {
      value += 1;
    }
    if (
      this.#negative !== null &&
      this.#negative.evaluate(input)
    ) {
      value -= 1;
    }

    return value;
  }

  reset(): void {
    this.#positive?.reset();
    this.#negative?.reset();
  }
}
