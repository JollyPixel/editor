// Import Internal Dependencies
import { Input } from "../../src/index.ts";
import type { InputCondition } from "../../src/combination/conditions/index.ts";
import * as mocks from "../mocks/index.ts";

export interface CombinationFixture {
  canvas: mocks.CanvasAdapter;
  input: Input;
}

export function createCombinationFixture(): CombinationFixture {
  const canvas = new mocks.CanvasAdapter();
  const input = new Input(canvas, {
    documentAdapter: new mocks.DocumentAdapter()
  });
  input.mouse.connect();

  return {
    canvas,
    input
  };
}

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
