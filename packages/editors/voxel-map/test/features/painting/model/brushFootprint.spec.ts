// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  boundsOf,
  cellsOf,
  isBrushAxis,
  isBrushPattern,
  lockAxisOf,
  overlaps,
  planeThrough,
  type BrushAxis,
  type BrushFootprint
} from "../../../../src/features/painting/model/brushFootprint.ts";

// CONSTANTS
const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};

function footprint(
  patch: Partial<BrushFootprint> = {}
): BrushFootprint {
  return {
    position: kOrigin,
    size: 1,
    axis: "xz",
    pattern: "square",
    ...patch
  };
}

function keysOf(
  cells: Iterable<{ x: number; y: number; z: number; }>
): string[] {
  return [...cells].map((cell) => `${cell.x},${cell.y},${cell.z}`).sort();
}

describe("brushFootprint.boundsOf", () => {
  test("centers X and Z and grows Y upward from the aimed cell", () => {
    const position = {
      x: 4,
      y: 2,
      z: -1
    };
    const expected: Record<BrushAxis, ReturnType<typeof boundsOf>> = {
      xz: {
        min: { x: 3, y: 2, z: -2 },
        span: { x: 3, y: 1, z: 3 }
      },
      xy: {
        min: { x: 3, y: 2, z: -1 },
        span: { x: 3, y: 3, z: 1 }
      },
      yz: {
        min: { x: 4, y: 2, z: -2 },
        span: { x: 1, y: 3, z: 3 }
      },
      xyz: {
        min: { x: 3, y: 2, z: -2 },
        span: { x: 3, y: 3, z: 3 }
      }
    };

    for (const axis of ["xz", "xy", "yz", "xyz"] as const) {
      assert.deepStrictEqual(
        boundsOf(footprint({ position, size: 3, axis })),
        expected[axis],
        axis
      );
    }
  });
});

describe("brushFootprint.cellsOf", () => {
  test("a size of 1 covers the aimed cell on every axis and pattern", () => {
    for (const axis of ["xz", "xy", "yz", "xyz"] as const) {
      for (const pattern of ["square", "circle"] as const) {
        assert.deepStrictEqual(
          cellsOf(footprint({ axis, pattern })),
          [kOrigin]
        );
      }
    }
  });

  test("a square fills its bounds", () => {
    const counts: Record<BrushAxis, number> = {
      xz: 16,
      xy: 16,
      yz: 16,
      xyz: 64
    };

    for (const axis of ["xz", "xy", "yz", "xyz"] as const) {
      assert.strictEqual(
        cellsOf(footprint({ size: 4, axis })).length,
        counts[axis]
      );
    }
  });

  test("an even square leans towards the negative side of X and Z", () => {
    assert.deepStrictEqual(
      keysOf(cellsOf(footprint({ size: 2 }))),
      ["-1,0,-1", "-1,0,0", "0,0,-1", "0,0,0"]
    );
  });

  test("an xy square stands on the aimed cell", () => {
    const cells = cellsOf(footprint({ size: 3, axis: "xy" }));

    assert.ok(cells.every((cell) => cell.z === 0));
    assert.deepStrictEqual(
      [...new Set(cells.map((cell) => cell.y))],
      [0, 1, 2]
    );
  });

  test("a circle matches the square up to a size of 3", () => {
    for (const size of [1, 2, 3]) {
      assert.deepStrictEqual(
        keysOf(cellsOf(footprint({ size, pattern: "circle" }))),
        keysOf(cellsOf(footprint({ size })))
      );
    }
  });

  test("a circle drops the corners of a size 4 disc", () => {
    const cells = keysOf(cellsOf(footprint({ size: 4, pattern: "circle" })));

    assert.strictEqual(cells.length, 12);
    assert.ok(!cells.includes("-2,0,-2"));
    assert.ok(!cells.includes("1,0,1"));
    assert.ok(cells.includes("-1,0,-1"));
  });

  test("an even circle is symmetric around its center", () => {
    const cells = cellsOf(footprint({ size: 8, pattern: "circle" }));
    const keys = new Set(keysOf(cells));

    for (const cell of cells) {
      assert.ok(keys.has(`${-cell.x - 1},0,${cell.z}`));
      assert.ok(keys.has(`${cell.x},0,${-cell.z - 1}`));
    }
  });

  test("a circle on a vertical axis is a disc in that plane", () => {
    const cells = cellsOf(footprint({
      size: 4,
      axis: "yz",
      pattern: "circle"
    }));

    assert.strictEqual(cells.length, 12);
    assert.ok(cells.every((cell) => cell.x === 0));
  });

  test("an xyz circle is a ball resting on the aimed cell", () => {
    const cells = cellsOf(footprint({
      size: 4,
      axis: "xyz",
      pattern: "circle"
    }));

    assert.strictEqual(cells.length, 32);
    assert.strictEqual(Math.min(...cells.map((cell) => cell.y)), 0);
    assert.strictEqual(Math.max(...cells.map((cell) => cell.y)), 3);
  });
});

describe("brushFootprint.overlaps", () => {
  test("never overlaps a missing footprint", () => {
    assert.strictEqual(overlaps(footprint(), null), false);
    assert.strictEqual(overlaps(null, footprint()), false);
    assert.strictEqual(overlaps(null, null), false);
  });

  test("a footprint overlaps itself", () => {
    assert.strictEqual(overlaps(footprint(), footprint()), true);
  });

  test("flat footprints one level apart do not overlap", () => {
    assert.strictEqual(
      overlaps(footprint(), footprint({ position: { x: 0, y: 1, z: 0 } })),
      false
    );
  });

  test("a wall reaches the cells above its base", () => {
    const wall = footprint({
      size: 3,
      axis: "xy"
    });

    assert.strictEqual(
      overlaps(wall, footprint({ position: { x: 1, y: 2, z: 0 } })),
      true
    );
    assert.strictEqual(
      overlaps(wall, footprint({ position: { x: 1, y: 3, z: 0 } })),
      false
    );
    assert.strictEqual(
      overlaps(wall, footprint({ position: { x: 0, y: 1, z: 1 } })),
      false
    );
  });

  test("stops overlapping once the footprints part on Z", () => {
    const wide = footprint({
      position: { x: 0, y: 0, z: 2 },
      size: 3
    });

    assert.strictEqual(overlaps(footprint(), wide), false);
    assert.strictEqual(
      overlaps(footprint(), { ...wide, position: { x: 0, y: 0, z: 1 } }),
      true
    );
  });
});

describe("brushFootprint planes", () => {
  test("locks the axis the footprint does not span", () => {
    assert.strictEqual(lockAxisOf("xz"), "y");
    assert.strictEqual(lockAxisOf("xy"), "z");
    assert.strictEqual(lockAxisOf("yz"), "x");
    assert.strictEqual(lockAxisOf("xyz"), "y");
  });

  test("passes through the given cell", () => {
    assert.deepStrictEqual(
      planeThrough("yz", { x: 5, y: 1, z: 2 }),
      { axis: "x", value: 5 }
    );
  });
});

describe("brushFootprint guards", () => {
  test("accept known values only", () => {
    assert.ok(isBrushAxis("xyz"));
    assert.ok(!isBrushAxis("zx"));
    assert.ok(!isBrushAxis(undefined));
    assert.ok(isBrushPattern("circle"));
    assert.ok(!isBrushPattern("rectangle"));
  });
});
