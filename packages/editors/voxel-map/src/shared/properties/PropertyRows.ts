// Import Third-party Dependencies
import type { BlockProperties } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  PropertyRow,
  type PropertyValue
} from "./PropertyRow.ts";

export class PropertyRows implements Iterable<PropertyRow> {
  static from(
    properties: Readonly<Record<string, unknown>>
  ): PropertyRows {
    const rows: PropertyRow[] = [];
    for (const [key, value] of Object.entries(properties)) {
      if (PropertyRows.#editable(value)) {
        rows.push(new PropertyRow(key, value));
      }
    }

    return new PropertyRows(rows);
  }

  static uneditable(
    properties: Readonly<Record<string, unknown>>
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(properties).filter(([, value]) => !PropertyRows.#editable(value))
    );
  }

  static #editable(
    value: unknown
  ): value is PropertyValue {
    return typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value));
  }

  readonly #rows: readonly PropertyRow[];

  constructor(
    rows: Iterable<PropertyRow> = []
  ) {
    this.#rows = [...rows];

    Object.freeze(this);
  }

  get size(): number {
    return this.#rows.length;
  }

  toProperties(): BlockProperties {
    const properties: BlockProperties = {};
    for (const { key, value } of this.#rows) {
      const trimmed = key.trim();
      if (trimmed) {
        properties[trimmed] = value;
      }
    }

    return properties;
  }

  equals(
    other: PropertyRows
  ): boolean {
    const own = Object.entries(this.toProperties());
    const theirs = other.toProperties();

    return own.length === Object.keys(theirs).length &&
      own.every(([key, value]) => Object.hasOwn(theirs, key) && theirs[key] === value);
  }

  [Symbol.iterator](): IterableIterator<PropertyRow> {
    return this.#rows.values();
  }
}
