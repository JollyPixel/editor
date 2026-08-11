// Import Internal Dependencies
import type { IconName } from "../icon/registry.ts";

/**
 * Shared option shape for select, button-group, and flags controls.
 */
export interface JollyOption<TValue> {
  value: TValue;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}

/**
 * Selected interval for a range control.
 */
export interface Interval {
  from: number;
  to: number;
}
