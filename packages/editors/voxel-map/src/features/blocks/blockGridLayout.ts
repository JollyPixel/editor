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

export interface BlockCellRect {
  x: number;
  y: number;
  size: number;
}

export function blockCellRect(
  index: number,
  layout: BlockGridLayout,
  inset = 0
): BlockCellRect {
  const { cols, cellSize } = layout;
  const margin = Math.max(0, Math.min(inset, (cellSize - 1) / 2));

  return {
    x: ((index % cols) * cellSize) + margin,
    y: (Math.floor(index / cols) * cellSize) + margin,
    size: cellSize - (margin * 2)
  };
}
