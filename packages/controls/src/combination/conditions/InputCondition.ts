// Import Internal Dependencies
import type { InputDevices } from "../../types.ts";

export interface InputCondition {
  evaluate(
    input: InputDevices
  ): boolean;
  reset(): void;
}

export interface BoundInputCondition {
  (): boolean;
  reset(): void;
}

export function bindInputCondition(
  condition: InputCondition,
  input: InputDevices
): BoundInputCondition {
  return Object.assign(
    () => condition.evaluate(input),
    {
      reset: () => condition.reset()
    }
  );
}
