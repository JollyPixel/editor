// Import Internal Dependencies
import { nextEnabledIndex } from "./roving.ts";
import type { OptionGroups } from "./OptionGroups.ts";

export class OptionGrid<TValue> {
  readonly groups: OptionGroups<TValue>;
  readonly columns: number;
  readonly #enabled: readonly boolean[];
  readonly #rows: readonly (readonly number[])[];

  constructor(
    groups: OptionGroups<TValue>,
    columns: number
  ) {
    const width = Math.max(1, Math.floor(columns));
    const rows: (readonly number[])[] = [];
    for (const { indices } of groups) {
      for (let start = 0; start < indices.length; start += width) {
        rows.push(indices.slice(start, start + width));
      }
    }

    this.groups = groups;
    this.columns = width;
    this.#enabled = groups.options.map((option) => option.disabled !== true);
    this.#rows = rows;
  }

  get first(): number {
    return this.#enabled.indexOf(true);
  }

  get last(): number {
    return this.#enabled.lastIndexOf(true);
  }

  move(
    from: number,
    key: string
  ): number {
    switch (key) {
      case "ArrowRight":
        return nextEnabledIndex(this.#enabled, from, 1);
      case "ArrowLeft":
        return nextEnabledIndex(this.#enabled, from, -1);
      case "ArrowDown":
        return this.#vertical(from, 1);
      case "ArrowUp":
        return this.#vertical(from, -1);
      case "Home":
        return this.first;
      case "End":
        return this.last;
      default:
        return -1;
    }
  }

  #vertical(
    from: number,
    step: 1 | -1
  ): number {
    const row = this.#rows.findIndex((indices) => indices.includes(from));
    if (row === -1) {
      return this.first;
    }

    const column = this.#rows[row].indexOf(from);
    for (
      let target = row + step;
      target >= 0 && target < this.#rows.length;
      target += step
    ) {
      const nearest = this.#nearestEnabled(this.#rows[target], column);
      if (nearest !== -1) {
        return nearest;
      }
    }

    return from;
  }

  #nearestEnabled(
    row: readonly number[],
    column: number
  ): number {
    let nearest = -1;
    let distance = Infinity;
    row.forEach((index, position) => {
      const offset = Math.abs(position - column);
      if (this.#enabled[index] && offset < distance) {
        nearest = index;
        distance = offset;
      }
    });

    return nearest;
  }
}
