// Import Internal Dependencies
import type { SelectionRect } from "../types.ts";

export interface SelectionFootprint {
  rect: SelectionRect;
  mask: boolean[];
}

export interface SelectionChange {
  before: SelectionFootprint;
  after: SelectionFootprint;
}
