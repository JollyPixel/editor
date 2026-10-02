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

describe("filterScanlines", () => {
  const kExtremes = [0, 1, 2, 127, 128, 129, 254, 255];
  const layouts = [
    {
      bytesPerPixel: 1,
      width: 13
    },
    {
      bytesPerPixel: 2,
      width: 6
    },
    {
      bytesPerPixel: 3,
      width: 5
    },
    {
      bytesPerPixel: 3,
      width: 4
    },
    {
      bytesPerPixel: 4,
      width: 7
    }
  ];

  for (const { bytesPerPixel, width } of layouts) {
    const height = 6;
    const samples = Uint8ClampedArray.from(
      { length: width * height * bytesPerPixel },
      (_, index) => kExtremes[(index * 7 + (index >> 3)) % kExtremes.length]
    );

    for (const filter of FILTER_TYPES) {
      it(`applies filter ${filter} as specified (${bytesPerPixel} B/px, width ${width})`, () => {
        const filtered = filterScanlines(
          samples,
          width,
          height,
          bytesPerPixel,
          fixedFilter(filter)
        );

        assert.deepEqual(
          [...filtered],
          referenceFilter(samples, width, height, bytesPerPixel, filter)
        );
        assert.deepEqual(
          [...unfilterScanlines(filtered, width, height, bytesPerPixel)],
          [...samples]
        );
      });
    }
  }

  it("breaks Paeth ties in the order left, up, up-left", () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 250, 253, 255];

    for (const left of values) {
      for (const up of values) {
        for (const upLeft of values) {
          const samples = new Uint8ClampedArray([upLeft, up, left, 0]);
          const filtered = filterScanlines(samples, 2, 2, 1, fixedFilter(4));

          assert.equal(
            filtered[5],
            (256 - referencePaeth(left, up, upLeft)) % 256,
            `left ${left}, up ${up}, up-left ${upLeft}`
          );
          assert.equal(unfilterScanlines(filtered, 2, 2, 1)[3], 0);
        }
      }
    }
  });

  it("decodes rows that mix every filter at 4 bytes per pixel", () => {
    const width = 3;
    const height = FILTER_TYPES.length;
    const samples = Uint8ClampedArray.from(
      { length: width * height * 4 },
      (_, index) => (index * 151) % 256
    );
    let row = 0;
    const filtered = filterScanlines(
      samples,
      width,
      height,
      4,
      (current, above, bytesPerPixel, out) => fixedFilter(FILTER_TYPES[row++])(
        current,
        above,
        bytesPerPixel,
        out
      )
    );

    assert.deepEqual(
      [...unfilterScanlines(filtered, width, height, 4)],
      [...samples]
    );
  });
});

function referenceFilter(
  samples: Uint8ClampedArray,
  width: number,
  height: number,
  bytesPerPixel: number,
  filter: number
): number[] {
  const stride = width * bytesPerPixel;
  const out: number[] = [];

  for (let y = 0; y < height; y++) {
    out.push(filter);
    for (let x = 0; x < stride; x++) {
      const left = x < bytesPerPixel ? 0 : samples[y * stride + x - bytesPerPixel];
      const up = y === 0 ? 0 : samples[(y - 1) * stride + x];
      const upLeft = x < bytesPerPixel || y === 0 ?
        0 :
        samples[(y - 1) * stride + x - bytesPerPixel];
      const predictors = [
        0,
        left,
        up,
        Math.floor((left + up) / 2),
        referencePaeth(left, up, upLeft)
      ];

      out.push((samples[y * stride + x] - predictors[filter] + 256) % 256);
    }
  }

  return out;
}

function referencePaeth(
  left: number,
  up: number,
  upLeft: number
): number {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);

  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) {
    return left;
  }

  return distanceUp <= distanceUpLeft ? up : upLeft;
}
