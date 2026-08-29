// CONSTANTS
// Target preview-cell width in CSS pixels.
const kCellSize = 64;

export interface BlockGridLayout {
  /** Number of preview cells per row. */
  cols: number;
  /** Width and height of a cell, in whole CSS pixels. */
  cellSize: number;
}

/**
 * Splits the available width into square preview cells of at least
 * `kCellSize` CSS pixels. Cell size is rounded down to a whole CSS pixel so
 * the canvas is never resampled by the browser.
 *
 * Widths below one pixel are clamped to a single one-pixel cell.
 */
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
