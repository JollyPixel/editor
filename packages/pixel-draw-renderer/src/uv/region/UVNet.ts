// Import Internal Dependencies
import type { Vec2 } from "../../types.ts";
import {
  geometryAt,
  boundingRect
} from "../geometry/geometry.ts";
import type {
  UVGeometry,
  UVSlot
} from "../geometry/types.ts";
import {
  packNet,
  type UVNetFace
} from "./netLayout.ts";

export type UVNetCell = readonly UVSlot[];
export type UVNetRow = readonly (UVNetCell | null)[];
export type UVNetCellInput = UVSlot | Iterable<UVSlot> | null;

interface GridCell {
  row: number;
  column: number;
  slots: UVNetCell;
}

export class UVNet {
  static readonly packed = new UVNet();

  readonly rows: readonly UVNetRow[] | null;
  readonly #cells: ReadonlyMap<UVSlot, GridCell>;

  constructor(
    rows?: Iterable<Iterable<UVNetCellInput>>
  ) {
    if (rows === undefined) {
      this.rows = null;
      this.#cells = new Map();

      return;
    }

    const grid = Array.from(
      rows,
      (row) => Object.freeze(Array.from(row, normalizedCell))
    );
    const cells = new Map<UVSlot, GridCell>();
    grid.forEach((row, rowIndex) => {
      row.forEach((slots, column) => {
        if (slots === null) {
          return;
        }

        const cell = {
          row: rowIndex,
          column,
          slots
        };
        for (const slot of slots) {
          if (cells.has(slot)) {
            throw new RangeError(`UV slot "${slot}" appears twice in the net`);
          }
          cells.set(slot, cell);
        }
      });
    });
    if (cells.size === 0) {
      throw new RangeError("A UV net needs at least one slot");
    }

    this.rows = Object.freeze(grid);
    this.#cells = cells;
  }

  missingSlots(
    slots: Iterable<UVSlot>
  ): UVSlot[] {
    if (this.rows === null) {
      return [];
    }

    return [...slots].filter((slot) => !this.#cells.has(slot));
  }

  place(
    faces: readonly UVNetFace[],
    origin: Vec2
  ): Map<UVSlot, UVGeometry> {
    if (!faces.every((face) => this.#cells.has(face.face))) {
      return packNet(faces, origin);
    }

    const cells = [...Map.groupBy(faces, (face) => this.#cells.get(face.face)!)]
      .map(([cell, members]) => {
        return {
          cell,
          members,
          rect: boundingRect(leadFace(cell, members).geometry)
        };
      });
    const columns: number[] = [];
    const rows: number[] = [];
    for (const { cell, rect } of cells) {
      columns[cell.column] = Math.max(columns[cell.column] ?? 0, rect.width);
      rows[cell.row] = Math.max(rows[cell.row] ?? 0, rect.height);
    }

    const placed = new Map<UVSlot, UVGeometry>();
    for (const { cell, members, rect } of cells) {
      const target = {
        ...rect,
        x: origin.x + offset(columns, cell.column),
        y: origin.y + offset(rows, cell.row)
      };
      for (const member of members) {
        placed.set(member.face, geometryAt(member.geometry, target));
      }
    }

    return placed;
  }
}

function leadFace(
  cell: GridCell,
  members: readonly UVNetFace[]
): UVNetFace {
  return members.reduce(
    (lead, member) => (
      cell.slots.indexOf(member.face) < cell.slots.indexOf(lead.face) ?
        member :
        lead
    )
  );
}

function normalizedCell(
  cell: UVNetCellInput
): UVNetCell | null {
  if (cell === null) {
    return null;
  }

  const slots = typeof cell === "string" ? [cell] : [...cell];

  return slots.length === 0 ? null : Object.freeze(slots);
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
