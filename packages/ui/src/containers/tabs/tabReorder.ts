/**
 * Range of tab indices a tab can move within, `end` exclusive.
 */
export interface TabSegment {
  start: number;
  end: number;
}

/**
 * Segment a dragged tab stays in: bounded by the nearest fixed tab on each
 * side, so fixed tabs never change index. `null` when the tab is fixed or
 * out of range.
 */
export function tabSegment(
  fixed: readonly boolean[],
  from: number
): TabSegment | null {
  if (from < 0 || from >= fixed.length || fixed[from]) {
    return null;
  }

  let start = from;
  while (start > 0 && !fixed[start - 1]) {
    start--;
  }
  let end = from + 1;
  while (end < fixed.length && !fixed[end]) {
    end++;
  }

  return {
    start,
    end
  };
}

/**
 * Final index of a tab dropped at an insertion index of its segment, or
 * `null` when the drop moves nothing.
 */
export function tabDropTarget(
  segment: TabSegment,
  from: number,
  insertion: number
): number | null {
  const clamped = Math.min(
    Math.max(insertion, 0),
    segment.end - segment.start
  ) + segment.start;
  const to = clamped > from ? clamped - 1 : clamped;

  return to === from ? null : to;
}
