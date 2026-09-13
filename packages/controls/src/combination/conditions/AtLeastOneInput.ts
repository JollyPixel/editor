// Import Internal Dependencies
import type { Input } from "../../Input.class.ts";
import {
  bindInputCondition,
  type InputCondition,
  type BoundInputCondition
} from "./InputCondition.ts";

export class AtLeastOneInput implements InputCondition {
  #conditions: InputCondition[];

  constructor(
    conditions: InputCondition[]
  ) {
    this.#conditions = conditions;
  }

  evaluate(
    input: Input
  ): boolean {
    for (const condition of this.#conditions) {
      if (condition.evaluate(input)) {
        return true;
      }
    }

    return false;
  }

  reset(): void {
    for (const condition of this.#conditions) {
      condition.reset();
    }
  }

  bind(
    input: Input
  ): BoundInputCondition {
    return bindInputCondition(this, input);
  }
}
