// Import Internal Dependencies
import type { TreeDropWhere } from "./Tree.types.ts";

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

export function resolveDropDepth(
  clientX: number,
  containerLeft: number,
  indentUnit: number,
  chainLength: number
): number {
  const depth = Math.floor((clientX - containerLeft) / indentUnit);

  return Math.min(Math.max(depth, 0), chainLength - 1);
}
