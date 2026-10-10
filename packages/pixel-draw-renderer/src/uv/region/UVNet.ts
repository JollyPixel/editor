// Import Internal Dependencies
import type { Vec2 } from "../../types.ts";
import {
  geometryAt,
  rectOf
} from "../geometry/geometry.ts";
import type {
  UVGeometry,
  UVSlot
} from "../geometry/types.ts";
import {
  packNet,
  type UVNetCell
} from "./netLayout.ts";

export type UVNetRow = readonly (UVSlot | null)[];

interface GridCell {
  row: number;
  column: number;
}

export class UVNet {
  static readonly packed = new UVNet();

  readonly rows: readonly UVNetRow[] | null;
  readonly #cells: ReadonlyMap<UVSlot, GridCell>;

  constructor(
    rows?: Iterable<Iterable<UVSlot | null>>
  ) {
    if (rows === undefined) {
      this.rows = null;
      this.#cells = new Map();

      return;
    }

    const grid = Array.from(rows, (row) => Object.freeze([...row]));
    const cells = new Map<UVSlot, GridCell>();
    grid.forEach((row, rowIndex) => {
      row.forEach((slot, column) => {
        if (slot === null) {
          return;
        }
        if (cells.has(slot)) {
          throw new RangeError(`UV slot "${slot}" appears twice in the net`);
        }
        cells.set(slot, { row: rowIndex, column });
      });
    });
    if (cells.size === 0) {
      throw new RangeError("A UV net needs at least one slot");
    }

    this.rows = Object.freeze(grid);
    this.#cells = cells;
  }

  place(
    cells: readonly UVNetCell[],
    origin: Vec2
  ): Map<UVSlot, UVGeometry> {
    if (!cells.every((cell) => this.#cells.has(cell.face))) {
      return packNet(cells, origin);
    }

    const columns: number[] = [];
    const rows: number[] = [];
    for (const cell of cells) {
      const { row, column } = this.#cells.get(cell.face)!;
      const rect = rectOf(cell.geometry);
      columns[column] = Math.max(columns[column] ?? 0, rect.width);
      rows[row] = Math.max(rows[row] ?? 0, rect.height);
    }

    const placed = new Map<UVSlot, UVGeometry>();
    for (const cell of cells) {
      const { row, column } = this.#cells.get(cell.face)!;
      placed.set(
        cell.face,
        geometryAt(cell.geometry, {
          ...rectOf(cell.geometry),
          x: origin.x + offset(columns, column),
          y: origin.y + offset(rows, row)
        })
      );
    }

    return placed;
  }
}

function offset(
  sizes: readonly (number | undefined)[],
  index: number
): number {
  let total = 0;
  for (let before = 0; before < index; before++) {
    total += sizes[before] ?? 0;
  }

  return total;
}
