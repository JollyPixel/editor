// Import Internal Dependencies
import type { BrushMode } from "../../../app/state/index.ts";
import type {
  BrushAxis,
  BrushPattern
} from "../model/brushFootprint.ts";

export interface BrushToolOption<TValue extends string> {
  value: TValue;
  icon: string;
  label: string;
}

export interface BrushToolChoice<TValue extends string> {
  active: BrushToolOption<TValue>;
  alternatives: BrushToolOption<TValue>[];
}

// CONSTANTS
export const BRUSH_DISABLED_LABEL = "Select a voxel layer to paint";

export const BRUSH_MODE_OPTIONS: readonly BrushToolOption<BrushMode>[] = [
  { value: "build", icon: "brush-build", label: "Build" },
  { value: "replace", icon: "brush-replace", label: "Replace" }
];

export const BRUSH_AXIS_OPTIONS: readonly BrushToolOption<BrushAxis>[] = [
  { value: "xz", icon: "axis-xz", label: "Axis XZ" },
  { value: "xy", icon: "axis-xy", label: "Axis XY" },
  { value: "yz", icon: "axis-yz", label: "Axis YZ" },
  { value: "xyz", icon: "axis-xyz", label: "Axis XYZ" }
];

export const BRUSH_PATTERN_OPTIONS: readonly BrushToolOption<BrushPattern>[] = [
  { value: "square", icon: "pattern-square", label: "Square" },
  { value: "circle", icon: "pattern-circle", label: "Circle" }
];

export function choiceOf<TValue extends string>(
  options: readonly BrushToolOption<TValue>[],
  current: TValue
): BrushToolChoice<TValue> {
  const active = options.find((option) => option.value === current) ??
    options[0];

  return {
    active,
    alternatives: options.filter((option) => option !== active)
  };
}

export function toolLabel(
  label: string,
  shortcut: string,
  disabled: boolean
): string {
  return disabled ? BRUSH_DISABLED_LABEL : `${label} (${shortcut})`;
}
