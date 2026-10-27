export interface ComponentMove {
  id: string;
  beforeId?: string;
}

export function componentMove(
  ids: readonly string[],
  from: number,
  insertion: number
): ComponentMove | null {
  const id = ids[from];
  const slot = Math.min(Math.max(insertion, 0), ids.length);
  if (id === undefined || slot === from || slot === from + 1) {
    return null;
  }

  const beforeId = ids[slot];

  return beforeId === undefined ?
    { id } :
    {
      id,
      beforeId
    };
}
