// Import Internal Dependencies
import type { InputCondition } from "../../src/combination/conditions/index.ts";

export function stubCondition(
  result: boolean
): InputCondition & { resetCalls: number; } {
  return {
    resetCalls: 0,
    evaluate: () => result,
    reset() {
      this.resetCalls++;
    }
  };
}
