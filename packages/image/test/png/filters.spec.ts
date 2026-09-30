// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { chooseFilter } from "#src/png/filters.ts";

// CONSTANTS
const kBytesPerPixel = 1;

describe("chooseFilter", () => {
  it("picks None for a row whose samples are already near zero", () => {
    const row = new Uint8Array([0, 3, 0, 3]);

    assert.equal(chooseFilter(row, null, kBytesPerPixel), 0);
  });

  it("picks Sub for a row that repeats horizontally", () => {
    const row = new Uint8Array([90, 90, 90, 90]);

    assert.equal(chooseFilter(row, null, kBytesPerPixel), 1);
  });

  it("picks Up for a row identical to the one above", () => {
    const above = new Uint8Array([10, 90, 200, 70]);
    const row = new Uint8Array(above);

    assert.equal(chooseFilter(row, above, kBytesPerPixel), 2);
  });

  it("picks Average when each sample is the midpoint of its two neighbours", () => {
    const above = new Uint8Array([50, 100, 150, 200]);
    const row = new Uint8Array([0, 50, 100, 150]);

    assert.equal(chooseFilter(row, above, kBytesPerPixel), 3);
  });

  it("picks Paeth when neither neighbour alone predicts well", () => {
    const above = new Uint8Array([146, 159, 245, 212]);
    const row = new Uint8Array([162, 149, 176, 185]);

    assert.equal(chooseFilter(row, above, kBytesPerPixel), 4);
  });
});
