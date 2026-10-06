// Import Internal Dependencies
import type {
  BrushAxis,
  BrushMode,
  BrushPattern
} from "../BrushStore.ts";
import type { ChoiceOption } from "./toolChoice.ts";

// CONSTANTS
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

export function ghostLabel(
  size: number
): string {
  return size === 1 ? "Ghost block" : "Ghost block, size 1 only";
}

export interface BrushToolOption<TValue extends string>
  extends ChoiceOption<TValue> {
  icon?: string;
}

export function toolLabel(
  label: string,
  shortcut: string,
  blockedReason: string | null
): string {
  return blockedReason ?? `${label} (${shortcut})`;
}
