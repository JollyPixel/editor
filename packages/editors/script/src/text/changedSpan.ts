export interface ChangedSpan {
  start: number;
  beforeEnd: number;
  afterEnd: number;
}

export function changedSpan<TBefore, TAfter>(
  before: ArrayLike<TBefore>,
  after: ArrayLike<TAfter>,
  same: (before: TBefore, after: TAfter) => boolean = Object.is
): ChangedSpan {
  const limit = Math.min(before.length, after.length);
  let start = 0;
  while (start < limit && same(before[start], after[start])) {
    start++;
  }

  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (
    beforeEnd > start &&
    afterEnd > start &&
    same(before[beforeEnd - 1], after[afterEnd - 1])
  ) {
    beforeEnd--;
    afterEnd--;
  }

  return {
    start,
    beforeEnd,
    afterEnd
  };
}
