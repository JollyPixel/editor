// Import Internal Dependencies
import { formatVector } from "../monitors/format.ts";
import { isVec2Like } from "../math/guards.ts";
import type {
  Vec2Like,
  Vec3Like,
  Vec4Like
} from "../math/types.ts";

export type MonitorValue =
  | number
  | string
  | Vec2Like
  | Vec3Like
  | Vec4Like;

export interface MonitorDisplayOptions<TValue> {
  format?: (value: TValue) => string;
  precision?: number;
}

export function displayMonitorValue<TValue>(
  value: TValue,
  options: MonitorDisplayOptions<TValue> = {}
): unknown {
  if (options.format !== undefined) {
    return options.format(value);
  }
  if (isVec2Like(value)) {
    return formatVector(value, options.precision);
  }

  return value;
}
