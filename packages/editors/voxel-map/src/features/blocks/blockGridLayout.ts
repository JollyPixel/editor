// CONSTANTS
const kCellSize = 64;

export interface BlockGridLayout {
  cols: number;
  cellSize: number;
}

export function computeBlockGridLayout(
  availCssPx: number
): BlockGridLayout {
  const width = Number.isFinite(availCssPx)
    ? Math.max(1, Math.floor(availCssPx))
    : 1;
  const cols = Math.max(1, Math.floor(width / kCellSize));

  return {
    cols,
    cellSize: Math.max(1, Math.floor(width / cols))
  };
}
