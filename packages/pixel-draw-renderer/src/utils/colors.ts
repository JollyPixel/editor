// Import Internal Dependencies
import type { RGBA8 } from "../types.ts";

export function rgba8Equal(
  left: RGBA8,
  right: RGBA8
): boolean {
  return left.r === right.r &&
    left.g === right.g &&
    left.b === right.b &&
    left.a === right.a;
}
