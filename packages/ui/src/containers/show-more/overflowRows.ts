export function overflowRows<TRow>(
  rows: readonly TRow[],
  limit: number
): readonly TRow[] {
  const kept = Math.max(0, Math.floor(limit));

  return rows.length - kept >= 2 ? rows.slice(kept) : [];
}
