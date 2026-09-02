// Import Internal Dependencies
import type { Input } from "../../Input.class.ts";
import type { InputCondition } from "../../AtomicInput.ts";
import type { AxisSource } from "./AxisSource.ts";

export class ButtonAxisSource implements AxisSource {
  #positive: InputCondition | null;
  #negative: InputCondition | null;

  constructor(
    positive: InputCondition | null,
    negative: InputCondition | null
  ) {
    this.#positive = positive;
    this.#negative = negative;
  }

  sample(
    input: Input
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
