// Import Internal Dependencies
import type { DropCandidate } from "./dropIndex.ts";

export function slideOffsets(
  layout: readonly DropCandidate[],
  from: number,
  insertion: number
): number[] {
  const count = layout.length;
  const clamped = Math.min(Math.max(insertion, 0), count);
  const to = clamped > from ? clamped - 1 : clamped;
  const gap = count < 2 ?
    0 :
    layout[1].start - (layout[0].start + layout[0].size);
  const pitch = layout[from].size + gap;

  return layout.map((_, index) => {
    if (to > from && index > from && index <= to) {
      return -pitch;
    }
    if (to < from && index >= to && index < from) {
      return pitch;
    }

    return 0;
  });
}
