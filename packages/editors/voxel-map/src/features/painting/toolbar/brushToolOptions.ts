// Import Internal Dependencies
import type { BrushMode } from "../../../app/state/index.ts";
import type {
  BrushAxis,
  BrushPattern
} from "../model/brushFootprint.ts";
import type { ChoiceOption } from "../../../shared/toolChoice.ts";

// CONSTANTS
export const BRUSH_DISABLED_LABEL = "Select a voxel layer to paint";

export const BRUSH_MODE_OPTIONS: readonly BrushToolOption<BrushMode>[] = [
  {
    value: "build",
    icon: "brush-build",
    label: "Build"
  },
  {
    value: "replace",
    icon: "brush-replace",
    label: "Replace"
  }
];

export const BRUSH_AXIS_OPTIONS: readonly BrushToolOption<BrushAxis>[] = [
  {
    value: "xz",
    label: "Axis XZ"
  },
  {
    value: "xy",
    label: "Axis XY"
  },
  {
    value: "yz",
    label: "Axis YZ"
  },
  {
    value: "xyz",
    label: "Axis XYZ"
  }
];

export const BRUSH_PATTERN_OPTIONS: readonly BrushToolOption<BrushPattern>[] = [
  {
    value: "square",
    icon: "pattern-square",
    label: "Square"
  },
  {
    value: "circle",
    icon: "pattern-circle",
    label: "Circle"
  }
];

export { choiceOf } from "../../../shared/toolChoice.ts";

export interface BrushToolOption<TValue extends string>
  extends ChoiceOption<TValue> {
  icon?: string;
}

export function toolLabel(
  label: string,
  shortcut: string,
  disabled: boolean
): string {
  return disabled ? BRUSH_DISABLED_LABEL : `${label} (${shortcut})`;
}
