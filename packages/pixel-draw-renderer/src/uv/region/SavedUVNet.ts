// Import Internal Dependencies
import {
  UVNet,
  normalizeNetRows,
  type UVNetCellInput,
  type UVNetRow
} from "./UVNet.ts";

export interface SavedUVNetData {
  id: string;
  name: string;
  rows: UVNetRow[];
}

export interface SavedUVNetInit {
  id: string;
  name: string;
  rows: Iterable<Iterable<UVNetCellInput>>;
}

export class SavedUVNet {
  static parse(
    value: unknown
  ): SavedUVNet | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }

    const id: unknown = Reflect.get(value, "id");
    const name: unknown = Reflect.get(value, "name");
    const rows: unknown = Reflect.get(value, "rows");
    if (
      typeof id !== "string" ||
      typeof name !== "string" ||
      !Array.isArray(rows) ||
      !rows.every(isRow)
    ) {
      return null;
    }

    try {
      return new SavedUVNet({
        id,
        name,
        rows
      });
    }
    catch {
      return null;
    }
  }

  readonly id: string;
  readonly name: string;
  readonly rows: readonly UVNetRow[];
  readonly net: UVNet;

  constructor(
    init: SavedUVNetInit
  ) {
    if (init.id.length === 0) {
      throw new TypeError("A saved UV net needs an id");
    }

    this.id = init.id;
    this.name = init.name;
    this.rows = normalizeNetRows(init.rows);
    this.net = new UVNet(this.rows);

    Object.freeze(this);
  }

  with(
    changes: Partial<Omit<SavedUVNetInit, "id">>
  ): SavedUVNet {
    return new SavedUVNet({
      id: this.id,
      name: changes.name ?? this.name,
      rows: changes.rows ?? this.rows
    });
  }

  equals(
    other: SavedUVNet
  ): boolean {
    return this.id === other.id &&
      this.name === other.name &&
      JSON.stringify(this.rows) === JSON.stringify(other.rows);
  }

  toJSON(): SavedUVNetData {
    return {
      id: this.id,
      name: this.name,
      rows: [...this.rows]
    };
  }
}

function isRow(
  value: unknown
): value is (string[] | null)[] {
  return Array.isArray(value) && value.every(
    (cell) => cell === null || (
      Array.isArray(cell) &&
      cell.every((slot) => typeof slot === "string" && slot.length > 0)
    )
  );
}
