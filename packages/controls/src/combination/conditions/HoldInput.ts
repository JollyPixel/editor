// Import Internal Dependencies
import type { InputDevices } from "../../types.ts";
import type { InputCondition } from "./InputCondition.ts";

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
    input: InputDevices
  ): boolean {
    return this.sustain.evaluate(input);
  }

  reset(): void {
    this.entry.reset();
    this.sustain.reset();
  }
}
