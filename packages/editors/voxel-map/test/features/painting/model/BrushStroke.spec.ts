// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { BrushStroke } from "../../../../src/features/painting/model/BrushStroke.ts";

describe("BrushStroke", () => {
  function createStroke(): BrushStroke {
    return new BrushStroke({
      mode: "place",
      layerName: "Ground",
      plane: {
        axis: "y",
        value: 0
      },
      paint: {
        blockId: 1,
        rotation: 0,
        flipY: false
      }
    });
  }

  test("pulls a cell back to the height of the stroke", () => {
    assert.deepStrictEqual(
      createStroke().lock({ x: 1, y: 7, z: 2 }),
      { x: 1, y: 0, z: 2 }
    );
  });

  test("starts on the cell it was given", () => {
    assert.deepStrictEqual(
      createStroke().advance({ x: 1, y: 0, z: 2 }),
      [{ x: 1, y: 0, z: 2 }]
    );
  });

  test("joins the cells the pointer skipped over", () => {
    const stroke = createStroke();

    stroke.advance({ x: 0, y: 0, z: 0 });

    assert.deepStrictEqual(
      stroke.advance({ x: 3, y: 0, z: 0 }),
      [
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 0, z: 0 }
      ]
    );
  });

  test("holds its goal until the cursor reaches another cell", () => {
    const stroke = createStroke();

    stroke.steer({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });

    assert.deepStrictEqual(
      stroke.steer({ x: 5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      { x: 0, y: 0, z: 0 }
    );
    assert.deepStrictEqual(
      stroke.steer({ x: 5, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
      { x: 5, y: 0, z: 0 }
    );
  });

  test("locks the goal it steers to on the stroke height", () => {
    const stroke = createStroke();

    assert.deepStrictEqual(
      stroke.steer({ x: 2, y: 9, z: 3 }, { x: 2, y: 9, z: 3 }),
      { x: 2, y: 0, z: 3 }
    );
  });

  test("trails a target it has not reached yet", () => {
    const stroke = createStroke();

    stroke.advance({ x: 0, y: 0, z: 0 });

    assert.strictEqual(stroke.trails({ x: 2, y: 0, z: 0 }), true);
    assert.strictEqual(stroke.trails({ x: 0, y: 0, z: 0 }), false);
    // Targets are compared where they land, not at the height they came in at.
    assert.strictEqual(stroke.trails({ x: 0, y: 9, z: 0 }), false);
  });

  test("never leaves its height, whatever it is aimed at", () => {
    const stroke = createStroke();

    stroke.advance({ x: 0, y: 0, z: 0 });

    assert.ok(
      stroke.advance({ x: 2, y: 5, z: 2 }).every((cell) => cell.y === 0)
    );
  });

  test("stays still when the pointer did not change cell", () => {
    const stroke = createStroke();

    stroke.advance({ x: 1, y: 0, z: 1 });

    assert.deepStrictEqual(stroke.advance({ x: 1, y: 0, z: 1 }), []);
  });

  test("claims a cell once", () => {
    const stroke = createStroke();
    const cells = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 }
    ];

    assert.deepStrictEqual(stroke.claim(cells), cells);
    assert.deepStrictEqual(
      stroke.claim([
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 }
      ]),
      [{ x: 2, y: 0, z: 0 }]
    );
  });

  test("pulls a cell back onto a vertical plane", () => {
    const stroke = new BrushStroke({
      mode: "remove",
      layerName: "Ground",
      axis: "xy",
      plane: {
        axis: "z",
        value: 4
      }
    });

    assert.deepStrictEqual(
      stroke.lock({ x: 1, y: 7, z: 2 }),
      { x: 1, y: 7, z: 4 }
    );
    stroke.advance({ x: 0, y: 0, z: 4 });
    assert.ok(
      stroke.advance({ x: 3, y: 3, z: 9 }).every((cell) => cell.z === 4)
    );
  });

  test("defaults to a flat square footprint", () => {
    const stroke = createStroke();

    assert.strictEqual(stroke.axis, "xz");
    assert.strictEqual(stroke.pattern, "square");
  });

  test("carries what a placement needs", () => {
    const stroke = createStroke();

    assert.strictEqual(stroke.mode, "place");
    assert.strictEqual(stroke.layerName, "Ground");
    assert.deepStrictEqual(stroke.paint, {
      blockId: 1,
      rotation: 0,
      flipY: false
    });
  });
});
