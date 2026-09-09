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

/**
 * Past the edge row, horizontal position picks how far to promote the
 * dragged node: band 0 is the root's own indent, and each step right moves
 * one level deeper, capping at `chainLength - 1` (the edge row's own depth,
 * a no-op when that row is the node being dragged).
 */
export function resolveDropDepth(
  clientX: number,
  containerLeft: number,
  indentUnit: number,
  chainLength: number
): number {
  const depth = Math.floor((clientX - containerLeft) / indentUnit);

  return Math.min(Math.max(depth, 0), chainLength - 1);
}
