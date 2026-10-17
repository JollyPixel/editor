// Import Internal Dependencies
import type { IconName } from "../icon/registry.ts";

export interface JollyOption<TValue> {
  value: TValue;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}

export interface Interval {
  from: number;
  to: number;
}
