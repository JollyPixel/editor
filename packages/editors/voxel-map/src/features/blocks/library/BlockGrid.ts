// CONSTANTS
const kCellSize = 64;

export interface BlockScrollWindow {
  scrollTop: number;
  height: number;
}

export interface BlockInsertMarker {
  x: number;
  y: number;
  height: number;
}

export class BlockCell {
  readonly x: number;
  readonly y: number;
  readonly size: number;

  constructor(
    x: number,
    y: number,
    size: number
  ) {
    this.x = x;
    this.y = y;
    this.size = size;
  }

  get style(): string {
    return [
      `left:${this.x}px`,
      `top:${this.y}px`,
      `width:${this.size}px`,
      `height:${this.size}px`
    ].join(";");
  }

  scrollTopToReveal(
    view: BlockScrollWindow
  ): number | null {
    const { scrollTop, height } = view;
    if (height <= 0) {
      return null;
    }
    if (this.y < scrollTop) {
      return this.y;
    }

    const bottom = this.y + this.size;

    return bottom > scrollTop + height ? bottom - height : null;
  }
}

export class BlockGrid {
  static fit(
    availCssPx: number
  ): BlockGrid {
    const width = Number.isFinite(availCssPx) ?
      Math.max(1, Math.floor(availCssPx)) :
      1;
    const cols = Math.max(1, Math.floor(width / kCellSize));

    return new BlockGrid(cols, Math.max(1, Math.floor(width / cols)));
  }

  static moveTarget(
    fromIndex: number,
    insertAt: number,
    count: number
  ): number {
    if (fromIndex < 0 || count <= 0) {
      return -1;
    }

    const target = fromIndex < insertAt ? insertAt - 1 : insertAt;
    const clamped = Math.min(Math.max(target, 0), count - 1);

    return clamped === fromIndex ? -1 : clamped;
  }

  readonly cols: number;
  readonly cellSize: number;

  constructor(
    cols: number,
    cellSize: number
  ) {
    this.cols = cols;
    this.cellSize = cellSize;
  }

  rows(
    count: number
  ): number {
    return Math.ceil((Math.max(0, count) + 1) / Math.max(1, this.cols));
  }

  cellAt(
    index: number,
    inset = 0
  ): BlockCell {
    const { cols, cellSize } = this;
    const margin = Math.max(0, Math.min(inset, (cellSize - 1) / 2));

    return new BlockCell(
      ((index % cols) * cellSize) + margin,
      (Math.floor(index / cols) * cellSize) + margin,
      cellSize - (margin * 2)
    );
  }

  indexAt(
    px: number,
    py: number
  ): number | null {
    const col = Math.floor(px / this.cellSize);
    const row = Math.floor(py / this.cellSize);
    if (col < 0 || row < 0 || col >= this.cols) {
      return null;
    }

    return (row * this.cols) + col;
  }

  insertIndex(
    px: number,
    py: number,
    count: number
  ): number {
    const { cols, cellSize } = this;
    if (count <= 0) {
      return 0;
    }

    const lastRow = Math.floor(count / cols);
    const row = Math.min(Math.max(Math.floor(py / cellSize), 0), lastRow);
    const slot = Math.min(Math.max(Math.round(px / cellSize), 0), cols);

    return Math.min((row * cols) + slot, count);
  }

  insertMarker(
    insertAt: number
  ): BlockInsertMarker {
    const { cols, cellSize } = this;

    return {
      x: (insertAt % cols) * cellSize,
      y: Math.floor(insertAt / cols) * cellSize,
      height: cellSize
    };
  }

  equals(
    other: BlockGrid
  ): boolean {
    return this.cols === other.cols && this.cellSize === other.cellSize;
  }
}
