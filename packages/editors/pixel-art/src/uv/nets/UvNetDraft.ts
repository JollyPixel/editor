// Import Third-party Dependencies
import type {
  UVNetCell,
  UVNetRow,
  UVSlot
} from "@jolly-pixel/pixel-draw.renderer";

export interface UvNetCellPosition {
  row: number;
  column: number;
}

export class UvNetDraft {
  static from(
    rows: readonly UVNetRow[]
  ): UvNetDraft {
    return new UvNetDraft(
      rows.map((row) => row.map((cell) => cell ?? []))
    );
  }

  readonly cells: readonly (readonly UVNetCell[])[];

  constructor(
    cells: readonly (readonly UVNetCell[])[]
  ) {
    this.cells = Object.freeze(trimmed(cells));
  }

  get rowCount(): number {
    return this.cells.length;
  }

  get columnCount(): number {
    return this.cells[0]?.length ?? 0;
  }

  get slots(): UVSlot[] {
    return this.cells.flat(2);
  }

  cellAt(
    position: UvNetCellPosition
  ): UVNetCell {
    return this.cells[position.row]?.[position.column] ?? [];
  }

  find(
    slot: UVSlot
  ): UvNetCellPosition | null {
    for (let row = 0; row < this.rowCount; row++) {
      const column = this.cells[row].findIndex((cell) => cell.includes(slot));
      if (column !== -1) {
        return { row, column };
      }
    }

    return null;
  }

  placed(
    slot: UVSlot,
    target: UvNetCellPosition
  ): UvNetDraft {
    const grid = this.#without(slot);
    const width = Math.max(1, this.columnCount);
    let { row, column } = target;
    if (row < 0) {
      grid.unshift(emptyRow(width));
      row = 0;
    }
    while (row >= grid.length) {
      grid.push(emptyRow(width));
    }
    if (column < 0) {
      for (const cells of grid) {
        cells.unshift([]);
      }
      column = 0;
    }
    for (const cells of grid) {
      while (column >= cells.length) {
        cells.push([]);
      }
    }
    grid[row][column] = [...grid[row][column], slot];

    return new UvNetDraft(grid);
  }

  moved(
    slot: UVSlot,
    rows: number,
    columns: number
  ): UvNetDraft {
    const position = this.find(slot);
    if (position === null) {
      return this;
    }

    return this.placed(slot, {
      row: position.row + rows,
      column: position.column + columns
    });
  }

  unplaced(
    slot: UVSlot
  ): UvNetDraft {
    return this.find(slot) === null ? this : new UvNetDraft(this.#without(slot));
  }

  #without(
    slot: UVSlot
  ): UVSlot[][][] {
    return this.cells.map(
      (row) => row.map((cell) => cell.filter((member) => member !== slot))
    );
  }
}

function emptyRow(
  width: number
): UVSlot[][] {
  return Array.from({ length: width }, () => []);
}

function trimmed(
  cells: readonly (readonly UVNetCell[])[]
): UVNetCell[][] {
  const width = Math.max(0, ...cells.map((row) => row.length));
  const rows = cells
    .map((row) => Array.from({ length: width }, (_, column) => row[column] ?? []))
    .filter((row) => row.some((cell) => cell.length > 0));
  const columns = Array.from({ length: width }, (_, column) => column)
    .filter((column) => rows.some((row) => row[column].length > 0));

  return rows.map(
    (row) => columns.map((column) => Object.freeze([...row[column]]))
  );
}
