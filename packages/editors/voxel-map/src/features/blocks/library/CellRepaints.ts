export interface RepaintedCell<TMesh> {
  readonly block: {
    readonly id: number;
  };
  readonly mesh: TMesh;
}

export interface CellRange {
  first: number;
  last: number;
}

export type CellLook = "still" | "spinning" | "hidden";

export interface CellPaint {
  index: number;
  mode: Exclude<CellLook, "hidden"> | "erase";
}

export class CellRepaints<TMesh> {
  #painted: Array<TMesh | null | undefined> = [];

  invalidate(): void {
    this.#painted = [];
  }

  * due(
    cells: readonly RepaintedCell<TMesh>[],
    range: CellRange,
    lookFor: (blockId: number) => CellLook
  ): IterableIterator<CellPaint> {
    for (let index = cells.length; index < this.#painted.length; index++) {
      if (this.#painted[index] !== undefined) {
        yield {
          index,
          mode: "erase"
        };
      }
    }
    this.#painted.length = Math.min(this.#painted.length, cells.length);

    const last = Math.min(range.last, cells.length - 1);
    for (let index = Math.max(range.first, 0); index <= last; index++) {
      const { block, mesh } = cells[index];
      const look = lookFor(block.id);
      if (look === "spinning") {
        this.#painted[index] = null;
        yield {
          index,
          mode: "spinning"
        };
      }
      else if (look === "hidden" && this.#painted[index] !== undefined) {
        this.#painted[index] = undefined;
        yield {
          index,
          mode: "erase"
        };
      }
      else if (look === "still" && this.#painted[index] !== mesh) {
        this.#painted[index] = mesh;
        yield {
          index,
          mode: "still"
        };
      }
    }
  }
}
