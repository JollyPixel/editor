// Import Internal Dependencies
import type { ChunkCells } from "./chunkEncoding.ts";

export function encodeDenseRuns(
  chunk: ChunkCells,
  cellCount: number
): number[] {
  const { cells, values } = chunk;
  const runs: number[] = [];
  let next = 0;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const value = values[i];
    if (cell > next) {
      runs.push(cell - next, 0);
    }
    else if (runs.length > 0 && runs[runs.length - 1] === value) {
      runs[runs.length - 2]++;
      next = cell + 1;
      continue;
    }

    runs.push(1, value);
    next = cell + 1;
  }
  if (next < cellCount) {
    runs.push(cellCount - next, 0);
  }

  return runs;
}

export function validateDenseRuns(
  runs: ArrayLike<number>,
  cellCount: number,
  paletteSize: number
): void {
  if (runs.length % 2 !== 0) {
    throw new RangeError("runs has an odd length");
  }

  let covered = 0;
  for (let i = 0; i < runs.length; i += 2) {
    const length = runs[i];
    const value = runs[i + 1];
    if (length < 1) {
      throw new RangeError(`run ${i / 2} has length ${length}`);
    }
    if (value > paletteSize) {
      throw new RangeError(
        `run ${i / 2} has value ${value} past the palette (${paletteSize})`
      );
    }

    covered += length;
    if (covered > cellCount) {
      throw new RangeError(`runs cover more than ${cellCount} cells`);
    }
  }

  if (covered !== cellCount) {
    throw new RangeError(
      `runs cover ${covered} cells instead of ${cellCount}`
    );
  }
}

export function decodeDenseRuns(
  runs: ArrayLike<number>
): ChunkCells {
  let count = 0;
  for (let i = 0; i < runs.length; i += 2) {
    if (runs[i + 1] !== 0) {
      count += runs[i];
    }
  }

  const cells = new Uint32Array(count);
  const values = new Uint32Array(count);
  let cell = 0;
  let offset = 0;
  for (let i = 0; i < runs.length; i += 2) {
    const length = runs[i];
    const value = runs[i + 1];
    if (value === 0) {
      cell += length;
      continue;
    }

    for (const end = cell + length; cell < end; cell++) {
      cells[offset] = cell;
      values[offset] = value;
      offset++;
    }
  }

  return { cells, values };
}
