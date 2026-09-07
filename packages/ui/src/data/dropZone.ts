// Import Internal Dependencies
import type { TreeDropWhere } from "./Tree.types.ts";

/**
 * Splits a row into drop bands by pointer offset: the top quarter is
 * "above", the bottom quarter is "below", and the middle half is "inside".
 */
export function resolveRowDropZone(
  offsetY: number,
  height: number
): TreeDropWhere {
  const topQuarter = height / 4;
  const bottomQuarter = height * 3 / 4;

  if (offsetY < topQuarter) {
    return "above";
  }
  if (offsetY > bottomQuarter) {
    return "below";
  }

  return "inside";
}
