// Import Internal Dependencies
import type { Input } from "../../Input.class.ts";

export interface InputCondition {
  evaluate(
    input: Input
  ): boolean;
  reset(): void;
}

export interface BoundInputCondition {
  (): boolean;
  reset(): void;
}

export function bindInputCondition(
  condition: InputCondition,
  input: Input
): BoundInputCondition {
  return Object.assign(
    () => condition.evaluate(input),
    {
      reset: () => condition.reset()
    }
  );
}
