// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  BrushFootprint,
  type BrushFootprintOptions
} from "../../../../src/features/painting/model/BrushFootprint.ts";

// CONSTANTS
const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};

function footprint(
  patch: Partial<BrushFootprintOptions> = {}
): BrushFootprint {
  return new BrushFootprint({
    position: kOrigin,
    size: 1,
    pattern: "square",
    ...patch
  });
}

function keysOf(
  cells: Iterable<{ x: number; y: number; z: number; }>
): string[] {
  return [...cells].map((cell) => `${cell.x},${cell.y},${cell.z}`).sort();
}

describe("BrushFootprint.boundsOf", () => {
  test("centers X and Z on the aimed cell and stays one layer thick", () => {
    assert.deepStrictEqual(
      footprint({ position: { x: 4, y: 2, z: -1 }, size: 3 }).bounds,
      {
        min: { x: 3, y: 2, z: -2 },
        span: { x: 3, y: 1, z: 3 }
      }
    );
  });
});

describe("BrushFootprint.cellsOf", () => {
  test("a size of 1 covers the aimed cell with every pattern", () => {
    for (const pattern of ["square", "circle"] as const) {
      assert.deepStrictEqual(footprint({ pattern }).cells(), [kOrigin]);
    }
  });

  test("a square fills its bounds", () => {
    assert.strictEqual(footprint({ size: 4 }).cells().length, 16);
  });

  test("an even square leans towards the negative side of X and Z", () => {
    assert.deepStrictEqual(
      keysOf(footprint({ size: 2 }).cells()),
      ["-1,0,-1", "-1,0,0", "0,0,-1", "0,0,0"]
    );
  });

  test("a circle matches the square up to a size of 3", () => {
    for (const size of [1, 2, 3]) {
      assert.deepStrictEqual(
        keysOf(footprint({ size, pattern: "circle" }).cells()),
        keysOf(footprint({ size }).cells())
      );
    }
  });

  test("a circle drops the corners of a size 4 disc", () => {
    const cells = keysOf(footprint({ size: 4, pattern: "circle" }).cells());

    assert.strictEqual(cells.length, 12);
    assert.ok(!cells.includes("-2,0,-2"));
    assert.ok(!cells.includes("1,0,1"));
    assert.ok(cells.includes("-1,0,-1"));
  });

  test("an even circle is symmetric around its center", () => {
    const cells = footprint({ size: 8, pattern: "circle" }).cells();
    const keys = new Set(keysOf(cells));

    for (const cell of cells) {
      assert.ok(keys.has(`${-cell.x - 1},0,${cell.z}`));
      assert.ok(keys.has(`${cell.x},0,${-cell.z - 1}`));
    }
  });
});

describe("BrushFootprint.overlaps", () => {
  test("never overlaps a missing footprint", () => {
    assert.strictEqual(footprint().overlaps(null), false);
  });

  test("a footprint overlaps itself", () => {
    assert.strictEqual(footprint().overlaps(footprint()), true);
  });

  test("flat footprints one level apart do not overlap", () => {
    assert.strictEqual(
      footprint().overlaps(footprint({ position: { x: 0, y: 1, z: 0 } })),
      false
    );
  });

  test("stops overlapping once the footprints part on Z", () => {
    const wide = footprint({
      position: { x: 0, y: 0, z: 2 },
      size: 3
    });

    assert.strictEqual(footprint().overlaps(wide), false);
    assert.strictEqual(
      footprint().overlaps(wide.movedTo({ x: 0, y: 0, z: 1 })),
      true
    );
  });
});
