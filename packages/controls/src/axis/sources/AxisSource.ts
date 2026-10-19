// Import Internal Dependencies
import type { InputDevices } from "../../types.ts";

export interface AxisSource {
  sample(
    input: InputDevices
  ): number;
  reset(): void;
}
