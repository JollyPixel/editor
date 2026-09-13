// Import Internal Dependencies
import type { Input } from "../../Input.class.ts";
import {
  bindInputCondition,
  type InputCondition,
  type BoundInputCondition
} from "./InputCondition.ts";

export class HoldInput implements InputCondition {
  readonly entry: InputCondition;
  readonly sustain: InputCondition;

  constructor(
    entry: InputCondition,
    sustain: InputCondition
  ) {
    this.entry = entry;
    this.sustain = sustain;
  }

  evaluate(
    input: Input
  ): boolean {
    return this.sustain.evaluate(input);
  }

  reset(): void {
    this.entry.reset();
    this.sustain.reset();
  }

  bind(
    input: Input
  ): BoundInputCondition {
    return bindInputCondition(this, input);
  }
}
