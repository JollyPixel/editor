// Import Internal Dependencies
import type { TreeDropWhere } from "./Tree.types.ts";

/**
 * Splits a row into drop bands by pointer offset: the top quarter is
 * "above", the bottom quarter is "below", and the middle half is "inside".
 *
 * "inside" is offered on every row, leaf or branch. A leaf being a leaf is
 * current state, not a permanent incapacity — a node with no children today
 * is exactly what accepting one turns it into, so a generic tree cannot
 * assume otherwise. A domain that truly has nodes which can never accept a
 * child rejects that in its own `canDrop`/`jolly-reparent` handling, the
 * same way any other domain veto works; `jolly-tree` no longer guesses it
 * from a node's current `children`.
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
