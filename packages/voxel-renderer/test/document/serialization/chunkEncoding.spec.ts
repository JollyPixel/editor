// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodeChunk,
  encodeChunk,
  type ChunkCells
} from "../../../src/document/serialization/chunks/chunkEncoding.ts";
import {
  decodeDenseRuns,
  encodeDenseRuns
} from "../../../src/document/serialization/chunks/denseRuns.ts";
import {
  decodeSparseCells,
  encodeSparseCells
} from "../../../src/document/serialization/chunks/sparseCells.ts";

function chunkCells(
  cells: number[],
  values: number[]
): ChunkCells {
  return {
    cells: Uint32Array.from(cells),
    values: Uint32Array.from(values)
  };
}

function randomChunk(
  cellCount: number,
  fill: number,
  seed: number
): ChunkCells {
  let state = seed;
  function random(): number {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;

    return state / 2 ** 32;
  }

  const cells: number[] = [];
  const values: number[] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    if (random() < fill) {
      cells.push(cell);
      values.push(1 + Math.floor(random() * 3));
    }
  }

  return chunkCells(cells, values);
}

describe("encodeChunk", () => {
  it("writes a few scattered voxels as gap-encoded cells", () => {
    const chunk = chunkCells([17, 18, 19, 34], [1, 1, 1, 2]);

    assert.deepEqual(encodeChunk(chunk, 16 ** 3), {
      gaps: [17, 0, 0, 14],
      runs: [3, 1, 1, 2]
    });
  });
});

describe("chunk encodings round-trip", () => {
  for (const size of [1, 16, 32]) {
    const cellCount = size ** 3;

    for (const fill of [0, 0.05, 0.6, 1]) {
      const chunk = randomChunk(cellCount, fill, size + 1);

      it(`restores a chunk of size ${size} filled at ${fill}`, () => {
        const sparse = encodeSparseCells(chunk);

        assert.deepEqual(
          decodeDenseRuns(encodeDenseRuns(chunk, cellCount)),
          chunk
        );
        assert.deepEqual(decodeSparseCells(sparse.gaps, sparse.runs), chunk);
        assert.deepEqual(decodeChunk(encodeChunk(chunk, cellCount)), chunk);
      });
    }
  }
});
