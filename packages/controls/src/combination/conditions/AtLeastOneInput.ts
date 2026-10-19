// Import Internal Dependencies
import type { InputDevices } from "../../types.ts";
import type { InputCondition } from "./InputCondition.ts";

export class AtLeastOneInput implements InputCondition {
  #conditions: InputCondition[];

  constructor(
    conditions: InputCondition[]
  ) {
    this.#conditions = conditions;
  }

  evaluate(
    input: InputDevices
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
}
