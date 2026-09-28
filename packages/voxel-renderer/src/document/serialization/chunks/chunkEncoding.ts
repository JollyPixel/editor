// Import Internal Dependencies
import {
  decodeDenseRuns,
  encodeDenseRuns,
  validateDenseRuns
} from "./denseRuns.ts";
import {
  decodeSparseCells,
  encodeSparseCells,
  validateSparseCells
} from "./sparseCells.ts";

export interface ChunkCells {
  cells: Uint32Array;
  values: Uint32Array;
}

export interface EncodedChunk<
  TSequence extends ArrayLike<number> = ArrayLike<number>
> {
  gaps: TSequence | null;
  runs: TSequence;
}

export function encodeChunk(
  chunk: ChunkCells,
  cellCount: number
): EncodedChunk<number[]> {
  const dense = encodeDenseRuns(chunk, cellCount);
  const sparse = encodeSparseCells(chunk);

  return dense.length <= sparse.gaps.length + sparse.runs.length ?
    { gaps: null, runs: dense } :
    sparse;
}

export function validateChunk(
  chunk: EncodedChunk,
  cellCount: number,
  paletteSize: number
): void {
  if (chunk.gaps === null) {
    validateDenseRuns(chunk.runs, cellCount, paletteSize);
  }
  else {
    validateSparseCells(chunk.gaps, chunk.runs, cellCount, paletteSize);
  }
}

export function decodeChunk(
  chunk: EncodedChunk
): ChunkCells {
  return chunk.gaps === null ?
    decodeDenseRuns(chunk.runs) :
    decodeSparseCells(chunk.gaps, chunk.runs);
}
