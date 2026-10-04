// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  traceSelectionContour
} from "#src/rendering/overlays/selectionContour.ts";

describe("traceSelectionContour", () => {
  for (const { label, size, mask } of [
    {
      label: "a full rectangle mask",
      size: 2,
      mask: [
        true, true,
        true, true
      ]
    },
    {
      label: "a single selected cell",
      size: 1,
      mask: [true]
    }
  ]) {
    test(`${label} traces its 4 corners, clockwise`, () => {
      const loops = traceSelectionContour(size, size, mask);

      assert.strictEqual(loops.length, 1);
      assert.deepStrictEqual(
        loops[0],
        [
          { x: 0, y: 0 },
          { x: size, y: 0 },
          { x: size, y: size },
          { x: 0, y: size }
        ]
      );
    });
  }

  test("an L-shape traces its true concave outline (6 corners), not the bounding rect's 4", () => {
    const loops = traceSelectionContour(
      2,
      2,
      [
        true, false,
        true, true
      ]
    );

    assert.strictEqual(loops.length, 1);
    assert.strictEqual(loops[0].length, 6);
  });

  test("a mask with a fully enclosed hole traces two loops (outer + inner)", () => {
    const ring = [
      true, true, true,
      true, false, true,
      true, true, true
    ];
    const loops = traceSelectionContour(3, 3, ring);

    assert.strictEqual(
      loops.length,
      2,
      "outer boundary + inner hole boundary"
    );
  });

  test("two cells sharing only a corner vertex trace as two separate loops", () => {
    const loops = traceSelectionContour(
      2,
      2,
      [
        true, false,
        false, true
      ]
    );

    assert.strictEqual(loops.length, 2);
    assert.deepStrictEqual(
      loops.map((loop) => loop.length),
      [4, 4],
      "each cell keeps its own unit square"
    );
  });

  test("a checkerboard traces one loop per cell", () => {
    const mask = [
      true, false, true,
      false, true, false,
      true, false, true
    ];
    const loops = traceSelectionContour(3, 3, mask);

    assert.strictEqual(loops.length, 5);
    assert.deepStrictEqual(
      loops.map((loop) => loop.length),
      [4, 4, 4, 4, 4]
    );
  });

  test("a corner-touching pair joined by a third cell stays one loop", () => {
    const loops = traceSelectionContour(
      2,
      2,
      [
        true, true,
        false, true
      ]
    );

    assert.strictEqual(loops.length, 1);
    assert.strictEqual(loops[0].length, 6);
  });

  test("an empty mask traces nothing", () => {
    assert.deepStrictEqual(
      traceSelectionContour(2, 2, [false, false, false, false]),
      []
    );
  });
});
