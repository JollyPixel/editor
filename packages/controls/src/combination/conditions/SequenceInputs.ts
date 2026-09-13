// Import Internal Dependencies
import type { Input } from "../../Input.class.ts";
import {
  bindInputCondition,
  type InputCondition,
  type BoundInputCondition
} from "./InputCondition.ts";
import { HoldInput } from "./HoldInput.ts";

export class SequenceInputs implements InputCondition {
  static DefaultTimeout = 100;

  #conditions: InputCondition[];
  #currentIndex = 0;
  #lastActivationTime = 0;
  #timeoutMs: number;
  #now: () => number;

  constructor(
    conditions: InputCondition[],
    timeoutMs: number = SequenceInputs.DefaultTimeout,
    now: () => number = Date.now
  ) {
    this.#conditions = conditions;
    this.#timeoutMs = timeoutMs;
    this.#now = now;
  }

  evaluate(
    input: Input
  ): boolean {
    const now = this.#now();

    this.#rollbackReleasedStep(input);
    if (
      !(this.#conditions[this.#currentIndex - 1] instanceof HoldInput) &&
      now - this.#lastActivationTime > this.#timeoutMs
    ) {
      this.#currentIndex = this.#resumeIndex(this.#currentIndex);
    }

    while (this.#currentIndex < this.#conditions.length) {
      const condition = this.#conditions[this.#currentIndex];
      const isHeld = condition instanceof HoldInput;
      const matched = isHeld ?
        condition.entry.evaluate(input) :
        condition.evaluate(input);
      if (!matched) {
        return false;
      }

      this.#currentIndex++;
      this.#lastActivationTime = now;

      if (this.#currentIndex >= this.#conditions.length) {
        this.#currentIndex = this.#resumeIndex(
          this.#conditions.length - 1
        );

        return true;
      }
      if (!isHeld) {
        return false;
      }
    }

    return false;
  }

  reset(): void {
    this.#currentIndex = 0;
    this.#lastActivationTime = 0;
    for (const condition of this.#conditions) {
      condition.reset();
    }
  }

  bind(
    input: Input
  ): BoundInputCondition {
    return bindInputCondition(this, input);
  }

  #rollbackReleasedStep(
    input: Input
  ): void {
    for (let index = 0; index < this.#currentIndex; index++) {
      const condition = this.#conditions[index];
      if (
        condition instanceof HoldInput &&
        !condition.sustain.evaluate(input)
      ) {
        this.#currentIndex = index;

        return;
      }
    }
  }

  #resumeIndex(
    limit: number
  ): number {
    for (let index = limit - 1; index >= 0; index--) {
      if (this.#conditions[index] instanceof HoldInput) {
        return index + 1;
      }
    }

    return 0;
  }
}
