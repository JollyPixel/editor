// Import Internal Dependencies
import type { ChunkCells } from "./chunkEncoding.ts";

export interface SparseCells {
  gaps: number[];
  runs: number[];
}

export function encodeSparseCells(
  chunk: ChunkCells
): SparseCells {
  const { cells, values } = chunk;
  const gaps: number[] = [];
  const runs: number[] = [];
  let previous = -1;

  for (let i = 0; i < cells.length; i++) {
    gaps.push(cells[i] - previous - 1);
    previous = cells[i];

    if (runs.length > 0 && runs[runs.length - 1] === values[i]) {
      runs[runs.length - 2]++;
    }
    else {
      runs.push(1, values[i]);
    }
  }

  return { gaps, runs };
}

export function validateSparseCells(
  gaps: ArrayLike<number>,
  runs: ArrayLike<number>,
  cellCount: number,
  paletteSize: number
): void {
  if (runs.length % 2 !== 0) {
    throw new RangeError("runs has an odd length");
  }

  let assigned = 0;
  for (let i = 0; i < runs.length; i += 2) {
    const length = runs[i];
    const value = runs[i + 1];
    if (length < 1) {
      throw new RangeError(`run ${i / 2} has length ${length}`);
    }
    if (value < 1 || value > paletteSize) {
      throw new RangeError(
        `run ${i / 2} has value ${value} outside the palette (1..${paletteSize})`
      );
    }

    assigned += length;
  }

  if (assigned !== gaps.length) {
    throw new RangeError(
      `runs assign ${assigned} cells instead of ${gaps.length}`
    );
  }

  let cell = -1;
  for (let i = 0; i < gaps.length; i++) {
    cell += gaps[i] + 1;
    if (cell >= cellCount) {
      throw new RangeError(`cell ${i} lies past ${cellCount - 1}`);
    }
  }
}

export function decodeSparseCells(
  gaps: ArrayLike<number>,
  runs: ArrayLike<number>
): ChunkCells {
  const cells = new Uint32Array(gaps.length);
  const values = new Uint32Array(gaps.length);

  let cell = -1;
  for (let i = 0; i < gaps.length; i++) {
    cell += gaps[i] + 1;
    cells[i] = cell;
  }

  let offset = 0;
  for (let i = 0; i < runs.length; i += 2) {
    values.fill(runs[i + 1], offset, offset + runs[i]);
    offset += runs[i];
  }

  return { cells, values };
}
