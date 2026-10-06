// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  BrushFootprint,
  type BrushBounds,
  type BrushFootprintOptions
} from "../../../../src/features/painting/model/BrushFootprint.ts";
import type { BrushAxis } from "../../../../src/features/painting/BrushStore.ts";

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
    axis: "xz",
    pattern: "square",
    ...patch
  });
}

function keysOf(
  cells: Iterable<{ x: number; y: number; z: number; }>
): string[] {
  return [...cells].map((cell) => `${cell.x},${cell.y},${cell.z}`).sort();
}

function layersOf(
  size: number
): string[][] {
  const keys = new Set(keysOf(footprint({
    size,
    axis: "xyz",
    pattern: "circle",
    anchor: "center"
  }).cells()));
  const half = Math.floor(size / 2);
  const range = Array.from({ length: size }, (_, index) => index - half);

  return range.slice(0, Math.ceil(size / 2)).map(
    (y) => range.map(
      (z) => range.map((x) => (keys.has(`${x},${y},${z}`) ? "#" : ".")).join("")
    )
  );
}

describe("BrushFootprint.boundsOf", () => {
  test("centers X and Z and grows Y upward from the aimed cell", () => {
    const position = {
      x: 4,
      y: 2,
      z: -1
    };
    const expected: Record<BrushAxis, BrushBounds> = {
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
        footprint({ position, size: 3, axis }).bounds,
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

  test("hangs the Y span below a top anchored cell", () => {
    assert.deepStrictEqual(
      footprint({ position, size: 3, axis: "yz", anchor: "top" }).bounds,
      {
        min: { x: 4, y: 0, z: -2 },
        span: { x: 1, y: 3, z: 3 }
      }
    );
  });

  test("centers the Y span like X and Z", () => {
    assert.deepStrictEqual(
      footprint({ position, size: 4, axis: "xyz", anchor: "center" }).bounds,
      {
        min: { x: 2, y: 0, z: -3 },
        span: { x: 4, y: 4, z: 4 }
      }
    );
  });

  test("leaves a flat footprint on the aimed height", () => {
    for (const anchor of ["bottom", "top", "center"] as const) {
      assert.strictEqual(
        footprint({ position, size: 5, anchor }).bounds.min.y,
        position.y
      );
    }
  });

  test("always keeps the aimed cell inside the footprint", () => {
    for (const anchor of ["bottom", "top", "center"] as const) {
      for (const size of [1, 2, 3, 4]) {
        const keys = keysOf(
          footprint({ position, size, axis: "xy", anchor }).cells()
        );

        assert.ok(keys.includes("4,2,-1"), `${anchor} ${size}`);
      }
    }
  });
});

describe("BrushFootprint.cellsOf", () => {
  test("a size of 1 covers the aimed cell on every axis and pattern", () => {
    for (const axis of ["xz", "xy", "yz", "xyz"] as const) {
      for (const pattern of ["square", "circle"] as const) {
        assert.deepStrictEqual(
          footprint({ axis, pattern }).cells(),
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
        footprint({ size: 4, axis }).cells().length,
        counts[axis]
      );
    }
  });

  test("an even square leans towards the negative side of X and Z", () => {
    assert.deepStrictEqual(
      keysOf(footprint({ size: 2 }).cells()),
      ["-1,0,-1", "-1,0,0", "0,0,-1", "0,0,0"]
    );
  });

  test("an xy square stands on the aimed cell", () => {
    const cells = footprint({ size: 3, axis: "xy" }).cells();

    assert.ok(cells.every((cell) => cell.z === 0));
    assert.deepStrictEqual(
      [...new Set(cells.map((cell) => cell.y))],
      [0, 1, 2]
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

  test("a circle on a vertical axis is a disc in that plane", () => {
    const cells = footprint({
      size: 4,
      axis: "yz",
      pattern: "circle"
    }).cells();

    assert.strictEqual(cells.length, 12);
    assert.ok(cells.every((cell) => cell.x === 0));
  });

  test("an xyz circle is a ball resting on the aimed cell", () => {
    const cells = footprint({
      size: 4,
      axis: "xyz",
      pattern: "circle"
    }).cells();

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
      const cells = footprint({
        size,
        axis: "xyz",
        pattern: "circle"
      }).cells();

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
      const cells = footprint({
        size,
        axis: "xyz",
        pattern: "circle",
        anchor: "center"
      }).cells();
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
    assert.ok(footprint({ axis: "xyz", pattern: "circle" }).isBall);
    assert.ok(!footprint({ axis: "xyz" }).isBall);
    assert.ok(!footprint({ pattern: "circle" }).isBall);
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

  test("a wall reaches the cells above its base", () => {
    const wall = footprint({
      size: 3,
      axis: "xy"
    });

    assert.strictEqual(
      wall.overlaps(footprint({ position: { x: 1, y: 2, z: 0 } })),
      true
    );
    assert.strictEqual(
      wall.overlaps(footprint({ position: { x: 1, y: 3, z: 0 } })),
      false
    );
    assert.strictEqual(
      wall.overlaps(footprint({ position: { x: 0, y: 1, z: 1 } })),
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
