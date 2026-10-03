// CONSTANTS
const kUsageRowPrefix = "usage:";

export function usageRowId(
  blockId: string
): string {
  return `${kUsageRowPrefix}${blockId}`;
}

export function blockOfUsageRow(
  rowId: string
): string | null {
  return rowId.startsWith(kUsageRowPrefix) ?
    rowId.slice(kUsageRowPrefix.length) :
    null;
}
