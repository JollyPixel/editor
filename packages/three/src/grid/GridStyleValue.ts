// Import Internal Dependencies
import type { GridStyle } from "./shader.ts";

// CONSTANTS
const kValidStyles: GridStyle[] = ["lines", "cross"];

export class GridStyleValue {
  readonly value: GridStyle;

  constructor(
    value: GridStyle,
    label: string
  ) {
    if (!kValidStyles.includes(value)) {
      throw new Error(`Invalid ${label} "${value}"`);
    }
    this.value = value;
  }
}
