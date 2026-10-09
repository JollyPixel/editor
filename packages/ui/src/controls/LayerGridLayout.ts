// Import Internal Dependencies
import { clamp } from "../numeric/bounds.ts";

// CONSTANTS
const kRowsPerBlock = 2;

export type LayerGridDirection =
  | "left"
  | "right"
  | "up"
  | "down"
  | "first"
  | "last";

export class LayerGridLayout {
  static readonly MaxCount = 32;

  readonly count: number;
  readonly columns: number;

  constructor(
    count: number,
    columns: number
  ) {
    this.count = LayerGridLayout.#integer(count, 1, LayerGridLayout.MaxCount);
    this.columns = LayerGridLayout.#integer(columns, 1, this.count);
  }

  get blockSize(): number {
    return this.columns * kRowsPerBlock;
  }

  contains(
    index: number
  ): boolean {
    return Number.isInteger(index) && index >= 0 && index < this.count;
  }

  blocks(): number[][] {
    const blocks: number[][] = [];
    for (let start = 0; start < this.count; start += this.blockSize) {
      const block: number[] = [];
      const end = Math.min(start + this.blockSize, this.count);
      for (let index = start; index < end; index++) {
        block.push(index);
      }
      blocks.push(block);
    }

    return blocks;
  }

  moveFrom(
    index: number,
    direction: LayerGridDirection
  ): number {
    if (direction === "first") {
      return 0;
    }
    if (direction === "last") {
      return this.count - 1;
    }

    const block = Math.floor(index / this.blockSize);
    const within = index % this.blockSize;
    const row = Math.floor(within / this.columns);
    const column = (block * this.columns) + (within % this.columns);

    const next = direction === "left" || direction === "right"
      ? this.#indexAt(column + (direction === "right" ? 1 : -1), row)
      : this.#indexAt(column, row + (direction === "down" ? 1 : -1));

    return next === null ? index : next;
  }

  #indexAt(
    column: number,
    row: number
  ): number | null {
    if (column < 0 || row < 0 || row >= kRowsPerBlock) {
      return null;
    }

    const block = Math.floor(column / this.columns);
    const index = (block * this.blockSize) +
      (row * this.columns) +
      (column % this.columns);

    return index < this.count ? index : null;
  }

  static #integer(
    value: number,
    min: number,
    max: number
  ): number {
    return Number.isFinite(value) ? clamp(Math.trunc(value), min, max) : max;
  }
}
