// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  adaptiveFilter,
  filterScanlines,
  fixedFilter,
  unfilterScanlines,
  FILTER_TYPES
} from "#src/png/filters.ts";

// CONSTANTS
const kBytesPerPixel = 1;
const kFirstRow = new Uint8ClampedArray(4);

function chosenFilter(
  row: Uint8ClampedArray,
  above: Uint8ClampedArray
): number {
  return adaptiveFilter(
    row,
    above,
    kBytesPerPixel,
    new Uint8Array(row.length)
  );
}

describe("adaptiveFilter", () => {
  it("picks None for a row whose samples are already near zero", () => {
    const row = new Uint8ClampedArray([0, 3, 0, 3]);

    assert.equal(chosenFilter(row, kFirstRow), 0);
  });

  it("picks Sub for a row that repeats horizontally", () => {
    const row = new Uint8ClampedArray([90, 90, 90, 90]);

    assert.equal(chosenFilter(row, kFirstRow), 1);
  });

  it("picks Up for a row identical to the one above", () => {
    const above = new Uint8ClampedArray([10, 90, 200, 70]);
    const row = new Uint8ClampedArray(above);

    assert.equal(chosenFilter(row, above), 2);
  });

  it("picks Average when each sample is the midpoint of its two neighbours", () => {
    const above = new Uint8ClampedArray([50, 100, 150, 200]);
    const row = new Uint8ClampedArray([0, 50, 100, 150]);

    assert.equal(chosenFilter(row, above), 3);
  });

  it("picks Paeth when neither neighbour alone predicts well", () => {
    const above = new Uint8ClampedArray([146, 159, 245, 212]);
    const row = new Uint8ClampedArray([162, 149, 176, 185]);

    assert.equal(chosenFilter(row, above), 4);
  });
});

describe("unfilterScanlines", () => {
  const size = 8;
  const bytesPerPixel = 4;
  const samples = Uint8ClampedArray.from(
    { length: size * size * bytesPerPixel },
    (_, index) => (index * 97) % 251
  );

  for (const filter of FILTER_TYPES) {
    it(`reverses filter ${filter} on every row`, () => {
      const filtered = filterScanlines(
        samples,
        size,
        size,
        bytesPerPixel,
        fixedFilter(filter)
      );

      assert.deepEqual(
        [...unfilterScanlines(filtered, size, size, bytesPerPixel)],
        [...samples]
      );
    });
  }
});
