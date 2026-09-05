// Import Internal Dependencies
import {
  Input,
  type AxisSource,
  type KeyCode
} from "../../src/index.ts";
import * as mocks from "../mocks/index.ts";

export interface AxisFixture {
  input: Input;
  press: (code: KeyCode) => void;
  release: (code: KeyCode) => void;
}

export function createAxisFixture(): AxisFixture {
  const input = new Input(new mocks.CanvasAdapter(), {
    documentAdapter: new mocks.DocumentAdapter()
  });

  return {
    input,
    press: (code) => input.keyboard.buttonsDown.add(code),
    release: (code) => input.keyboard.buttonsDown.delete(code)
  };
}

export function stubSource(
  value: number
): AxisSource & { resetCalls: number; } {
  return {
    resetCalls: 0,
    sample: () => value,
    reset() {
      this.resetCalls++;
    }
  };
}
