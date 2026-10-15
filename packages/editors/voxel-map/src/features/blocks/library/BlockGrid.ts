// CONSTANTS
const kCellSize = 64;

export interface BlockScrollWindow {
  scrollTop: number;
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

  landingIndex(
    px: number,
    py: number,
    count: number
  ): number {
    const { cols, cellSize } = this;
    const col = Math.min(Math.max(Math.floor(px / cellSize), 0), cols - 1);
    const row = Math.max(Math.floor(py / cellSize), 0);

    return Math.min((row * cols) + col, Math.max(count - 1, 0));
  }

  equals(
    other: BlockGrid
  ): boolean {
    return this.cols === other.cols && this.cellSize === other.cellSize;
  }
}
