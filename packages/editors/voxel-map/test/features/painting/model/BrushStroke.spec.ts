// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { BrushStroke } from "../../../../src/features/painting/model/BrushStroke.ts";

describe("BrushStroke", () => {
  function createStroke(
    origin = { x: 0, y: 0, z: 0 }
  ): BrushStroke {
    return new BrushStroke({
      mode: "place",
      layerName: "Ground",
      origin,
      paint: {
        blockId: 1,
        rotation: 0,
        flipY: false
      }
    });
  }

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

  test("stamps a cell alone and off its height when told not to join it", () => {
    const stroke = createStroke();

    stroke.advance({ x: 0, y: 0, z: 0 });

    assert.deepStrictEqual(
      stroke.advance({ x: 3, y: 2, z: 0 }, false),
      [{ x: 3, y: 2, z: 0 }]
    );
    assert.deepStrictEqual(
      stroke.advance({ x: 4, y: 0, z: 0 }),
      [{ x: 4, y: 0, z: 0 }]
    );
  });

  test("follows the cell a click would paint, at any height", () => {
    const aim = {
      place: { x: 2, y: 4, z: 3 },
      remove: { x: 2, y: 3, z: 3 }
    };
    const replace = new BrushStroke({
      mode: "replace",
      layerName: "Ground",
      origin: { x: 0, y: 0, z: 0 }
    });

    assert.deepStrictEqual(
      createStroke().follow(aim),
      { center: aim.place, paints: true, joins: true }
    );
    assert.deepStrictEqual(replace.follow(aim).center, aim.remove);
  });

  test("tracks the blocks it painted itself without painting from them", () => {
    const stroke = createStroke({ x: 0, y: 1, z: -1 });
    stroke.claim(stroke.advance(stroke.origin));
    stroke.claim(stroke.advance({ x: 3, y: 1, z: -1 }));

    assert.deepStrictEqual(
      stroke.follow({
        place: { x: 1, y: 1, z: -2 },
        remove: { x: 1, y: 1, z: -1 }
      }),
      { center: { x: 1, y: 1, z: -1 }, paints: false, joins: true }
    );
  });

  test("builds out from an older block on the face the pointer came back through", () => {
    const stroke = createStroke();
    stroke.claim(stroke.advance(stroke.origin));
    stroke.claim(stroke.advance({ x: 3, y: 0, z: 0 }));

    assert.deepStrictEqual(
      stroke.revisit({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }),
      { center: { x: 0, y: 0, z: -1 }, paints: true, joins: false }
    );
  });

  test("never builds out from its latest stamp, whatever the brush size", () => {
    const stroke = createStroke();
    stroke.claim(stroke.footprintAt(stroke.origin, 3).cells());
    stroke.claim(stroke.footprintAt({ x: 6, y: 0, z: 0 }, 3).cells());

    const extension = stroke.revisit(
      { x: 0, y: 0, z: -1 },
      { x: 0, y: 0, z: -1 }
    );
    stroke.claim(stroke.footprintAt(extension.center, 3).cells());

    assert.deepStrictEqual(extension.center, { x: 0, y: 0, z: -2 });
    assert.deepStrictEqual(
      stroke.revisit({ x: 1, y: 0, z: -1 }, { x: 1, y: 0, z: 0 }),
      { center: { x: 1, y: 0, z: -1 }, paints: false, joins: true }
    );
  });

  test("builds up from a top face, off its own height", () => {
    const stroke = createStroke();
    stroke.claim(stroke.advance(stroke.origin));
    stroke.claim(stroke.advance({ x: 3, y: 0, z: 0 }));

    assert.deepStrictEqual(
      stroke.revisit({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
      { center: { x: 0, y: 1, z: 0 }, paints: true, joins: false }
    );
  });

  test("keeps repainting around the cells it already replaced", () => {
    const stroke = new BrushStroke({
      mode: "replace",
      layerName: "Ground",
      origin: { x: 0, y: 1, z: 0 },
      paint: {
        blockId: 1,
        rotation: 0,
        flipY: false
      }
    });
    stroke.claim(stroke.footprintAt(stroke.origin, 3).cells());

    assert.strictEqual(stroke.claims({ x: 1, y: 1, z: 0 }), true);
    assert.deepStrictEqual(
      stroke.revisit({ x: 1, y: 1, z: 0 }),
      { center: { x: 1, y: 1, z: 0 }, paints: true, joins: true }
    );
  });

  test("joins a step along its lower side, then lands on the target", () => {
    const stroke = createStroke();

    stroke.advance({ x: 0, y: 0, z: 0 });

    assert.deepStrictEqual(
      stroke.advance({ x: 3, y: 2, z: 0 }),
      [
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 2, z: 0 }
      ]
    );
    assert.strictEqual(stroke.height, 2);
    assert.deepStrictEqual(
      stroke.advance({ x: 1, y: 0, z: 0 }),
      [
        { x: 2, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 }
      ]
    );
    assert.deepStrictEqual(
      stroke.advance({ x: 1, y: 1, z: 0 }),
      [{ x: 1, y: 1, z: 0 }]
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

  test("defaults to a square footprint", () => {
    assert.strictEqual(createStroke().pattern, "square");
  });
});
