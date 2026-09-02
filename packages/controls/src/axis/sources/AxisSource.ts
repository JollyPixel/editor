// Import Internal Dependencies
import type { Input } from "../../Input.class.ts";

export interface AxisSource {
  sample(
    input: Input
  ): number;
  reset(): void;
}
