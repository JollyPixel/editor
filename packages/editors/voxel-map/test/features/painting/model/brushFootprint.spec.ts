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
  isBall,
  isBrushAnchor,
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

function layersOf(
  size: number
): string[][] {
  const keys = new Set(keysOf(cellsOf(footprint({
    size,
    axis: "xyz",
    pattern: "circle",
    anchor: "center"
  }))));
  const half = Math.floor(size / 2);
  const range = Array.from({ length: size }, (_, index) => index - half);

  return range.slice(0, Math.ceil(size / 2)).map(
    (y) => range.map(
      (z) => range.map((x) => (keys.has(`${x},${y},${z}`) ? "#" : ".")).join("")
    )
  );
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

describe("brushFootprint anchor", () => {
  const position = {
    x: 4,
    y: 2,
    z: -1
  };

  test("accepts the three anchors and nothing else", () => {
    for (const anchor of ["bottom", "top", "center"]) {
      assert.ok(isBrushAnchor(anchor));
    }
    assert.ok(!isBrushAnchor("middle"));
    assert.ok(!isBrushAnchor(undefined));
  });

  test("hangs the Y span below a top anchored cell", () => {
    assert.deepStrictEqual(
      boundsOf(footprint({ position, size: 3, axis: "yz", anchor: "top" })),
      {
        min: { x: 4, y: 0, z: -2 },
        span: { x: 1, y: 3, z: 3 }
      }
    );
  });

  test("centers the Y span like X and Z", () => {
    assert.deepStrictEqual(
      boundsOf(footprint({ position, size: 4, axis: "xyz", anchor: "center" })),
      {
        min: { x: 2, y: 0, z: -3 },
        span: { x: 4, y: 4, z: 4 }
      }
    );
  });

  test("leaves a flat footprint on the aimed height", () => {
    for (const anchor of ["bottom", "top", "center"] as const) {
      assert.strictEqual(
        boundsOf(footprint({ position, size: 5, anchor })).min.y,
        position.y
      );
    }
  });

  test("always keeps the aimed cell inside the footprint", () => {
    for (const anchor of ["bottom", "top", "center"] as const) {
      for (const size of [1, 2, 3, 4]) {
        const keys = keysOf(
          cellsOf(footprint({ position, size, axis: "xy", anchor }))
        );

        assert.ok(keys.includes("4,2,-1"), `${anchor} ${size}`);
      }
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

  test("a ball rounds its caps instead of stacking square plates", () => {
    assert.deepStrictEqual(layersOf(5), [
      [
        ".....",
        "..#..",
        ".###.",
        "..#..",
        "....."
      ],
      [
        "..#..",
        ".###.",
        "#####",
        ".###.",
        "..#.."
      ],
      [
        ".###.",
        "#####",
        "#####",
        "#####",
        ".###."
      ]
    ]);
    assert.deepStrictEqual(layersOf(7)[0], [
      ".......",
      ".......",
      "...#...",
      "..###..",
      "...#...",
      ".......",
      "......."
    ]);
  });

  test("a ball spans its full size on every axis", () => {
    for (let size = 1; size <= 16; size++) {
      const cells = cellsOf(footprint({
        size,
        axis: "xyz",
        pattern: "circle"
      }));

      for (const coord of ["x", "y", "z"] as const) {
        const values = cells.map((cell) => cell[coord]);

        assert.strictEqual(
          Math.max(...values) - Math.min(...values) + 1,
          size,
          `${size} ${coord}`
        );
      }
    }
  });

  test("a ball is symmetric around its center", () => {
    for (const size of [6, 9]) {
      const cells = cellsOf(footprint({
        size,
        axis: "xyz",
        pattern: "circle",
        anchor: "center"
      }));
      const keys = new Set(keysOf(cells));
      const flip = size % 2 === 0 ? -1 : 0;

      for (const { x, y, z } of cells) {
        assert.ok(keys.has(`${flip - x},${y},${z}`));
        assert.ok(keys.has(`${x},${flip - y},${z}`));
        assert.ok(keys.has(`${x},${y},${flip - z}`));
      }
    }
  });

  test("only an xyz circle is a ball", () => {
    assert.ok(isBall(footprint({ axis: "xyz", pattern: "circle" })));
    assert.ok(!isBall(footprint({ axis: "xyz" })));
    assert.ok(!isBall(footprint({ pattern: "circle" })));
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
