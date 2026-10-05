// Import Internal Dependencies
import type { FieldLabelPosition } from "../field/LabelStackController.ts";

export interface FieldLayoutOptions {
  /**
   * Label placement; `"auto"` stacks the label above the value while the row
   * is narrower than `stackBelow`.
   * @default "inline"
   */
  labelPosition?: FieldLabelPosition;
  /**
   * Row width in pixels under which an `"auto"` label stacks.
   * @default 200
   */
  stackBelow?: number;
}

interface FieldLayoutTarget {
  labelPosition: FieldLabelPosition;
  stackBelow: number;
}

export function applyFieldLayout(
  target: FieldLayoutTarget,
  layout: FieldLayoutOptions
): void {
  if (layout.labelPosition !== undefined) {
    target.labelPosition = layout.labelPosition;
  }
  if (layout.stackBelow !== undefined) {
    target.stackBelow = layout.stackBelow;
  }
}

export function inheritFieldLayout<TOptions extends FieldLayoutOptions>(
  options: TOptions,
  inherited: FieldLayoutOptions
): TOptions {
  return {
    ...options,
    labelPosition: options.labelPosition ?? inherited.labelPosition,
    stackBelow: options.stackBelow ?? inherited.stackBelow
  };
}
