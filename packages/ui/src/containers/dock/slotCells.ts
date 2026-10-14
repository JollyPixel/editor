// Import Internal Dependencies
import type { Rect } from "../../geometry/Rect.ts";
import type { DropCandidate } from "../../interaction/drag/dropIndex.ts";

export function slotCells(
  bounds: Rect,
  candidates: readonly DropCandidate[],
  axis: "x" | "y"
): Rect[] {
  const first = axis === "y" ? bounds.y : bounds.x;
  const last = first + (axis === "y" ? bounds.height : bounds.width);

  return candidates.map((candidate, index) => {
    const start = index === 0 ?
      first :
      gapMiddle(candidates[index - 1], candidate);
    const end = index === candidates.length - 1 ?
      last :
      gapMiddle(candidate, candidates[index + 1]);

    return axis === "y" ?
      {
        x: bounds.x,
        y: start,
        width: bounds.width,
        height: end - start
      } :
      {
        x: start,
        y: bounds.y,
        width: end - start,
        height: bounds.height
      };
  });
}

function gapMiddle(
  before: DropCandidate,
  after: DropCandidate
): number {
  return (before.start + before.size + after.start) / 2;
}
