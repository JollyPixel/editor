export function slotIndex(
  ids: readonly string[],
  beforeId: string | undefined
): number {
  const index = beforeId === undefined ? -1 : ids.indexOf(beforeId);

  return index === -1 ? ids.length : index;
}

export function insertedBefore<T extends { id: string; }>(
  entries: readonly T[],
  entry: T,
  beforeId: string | undefined
): T[] {
  const placed = [...entries];
  placed.splice(slotIndex(entries.map(({ id }) => id), beforeId), 0, entry);

  return placed;
}

export function findNextId(
  ids: readonly string[],
  id: string
): string | undefined {
  const index = ids.indexOf(id);

  return index === -1 ? undefined : ids[index + 1];
}

export function withBefore(
  beforeId: string | undefined
): { beforeId?: string; } {
  return beforeId === undefined ? {} : { beforeId };
}
