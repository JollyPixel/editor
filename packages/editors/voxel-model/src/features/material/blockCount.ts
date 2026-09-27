export function blockCount(
  count: number
): string {
  return count === 1 ? "1 block" : `${count} blocks`;
}
