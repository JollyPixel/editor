// Import Internal Dependencies
import type { LayerGridMode } from "./LayerGrid.ts";
import {
  bitAt,
  hasFlag,
  setFlag
} from "./flagMask.ts";

export type LayerGridChecked = "true" | "false" | "mixed";

export type LayerGridBrush = (
  value: number,
  index: number
) => number;

export interface LayerGridSemantics {
  readonly groupRole: "group" | "radiogroup";
  readonly cellRole: "checkbox" | "radio";
  readonly selectionFollowsFocus: boolean;
  checked(
    value: number | undefined,
    index: number
  ): LayerGridChecked;
  selected(
    value: number | undefined
  ): number | null;
  brush(
    origin: number | undefined,
    index: number
  ): LayerGridBrush;
}

// CONSTANTS
const kMask: LayerGridSemantics = {
  groupRole: "group",
  cellRole: "checkbox",
  selectionFollowsFocus: false,
  checked(value, index) {
    if (value === undefined) {
      return "mixed";
    }

    return hasFlag(value, bitAt(index)) ? "true" : "false";
  },
  selected() {
    return null;
  },
  brush(origin, index) {
    const enable = origin === undefined || !hasFlag(origin, bitAt(index));

    return (value, at) => setFlag(value, bitAt(at), enable);
  }
};
const kIndex: LayerGridSemantics = {
  groupRole: "radiogroup",
  cellRole: "radio",
  selectionFollowsFocus: true,
  checked(value, index) {
    return value === index ? "true" : "false";
  },
  selected(value) {
    return value ?? null;
  },
  brush() {
    return (_value, at) => at;
  }
};

export function layerGridSemantics(
  mode: LayerGridMode
): LayerGridSemantics {
  return mode === "index" ? kIndex : kMask;
}
