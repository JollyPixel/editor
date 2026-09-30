export interface NavigableList {
  readonly items: readonly unknown[];
  readonly preselect: boolean;
}

export function initialHighlight(
  list: NavigableList
): number {
  return list.preselect && list.items.length > 0 ? 0 : -1;
}

export function moveHighlight(
  index: number,
  delta: 1 | -1,
  list: NavigableList
): number {
  const count = list.items.length;
  if (count === 0) {
    return -1;
  }

  if (list.preselect) {
    if (index < 0) {
      return delta === 1 ? 0 : count - 1;
    }

    return (index + delta + count) % count;
  }

  return Math.min(Math.max(index + delta, -1), count - 1);
}
