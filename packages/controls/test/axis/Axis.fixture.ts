// Import Internal Dependencies
import type {
  AxisSource,
  Input,
  KeyCode
} from "../../src/index.ts";
import { createInputFixture } from "../helpers/input.ts";

export interface AxisFixture {
  input: Input;
  press: (code: KeyCode) => void;
  release: (code: KeyCode) => void;
  tilt: (axes: number[]) => void;
}

export function createAxisFixture(): AxisFixture {
  const {
    input,
    press,
    release,
    plug
  } = createInputFixture();
  const pad = plug();

  return {
    input,
    press,
    release,
    tilt(axes) {
      pad.axes = axes;
      input.update();
    }
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
