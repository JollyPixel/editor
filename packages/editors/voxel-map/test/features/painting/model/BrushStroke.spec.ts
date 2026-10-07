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

  test("locks its plane through the origin on the axis it does not span", () => {
    const cases = [
      { axis: "xz", plane: { axis: "y", value: 5 } },
      { axis: "xy", plane: { axis: "z", value: 3 } },
      { axis: "yz", plane: { axis: "x", value: 2 } },
      { axis: "xyz", plane: { axis: "y", value: 5 } }
    ] as const;

    for (const { axis, plane } of cases) {
      const stroke = new BrushStroke({
        mode: "remove",
        layerName: "Ground",
        axis,
        origin: { x: 2, y: 5, z: 3 }
      });

      assert.deepStrictEqual(stroke.plane, plane, axis);
    }
  });

  test("follows each aimed block on the side it started from", () => {
    const onTop = new BrushStroke({
      mode: "place",
      layerName: "Ground",
      origin: { x: 0, y: 1, z: 0 },
      aimed: { x: 0, y: 0, z: 0 }
    });
    const beside = new BrushStroke({
      mode: "place",
      layerName: "Ground",
      origin: { x: 0, y: 1, z: -1 },
      aimed: { x: 0, y: 1, z: 0 }
    });

    assert.deepStrictEqual(
      onTop.follow({ x: 3, y: 0, z: 2 }),
      { center: { x: 3, y: 1, z: 2 }, paints: true }
    );
    assert.deepStrictEqual(
      beside.follow({ x: 4, y: 1, z: 0 }),
      { center: { x: 4, y: 1, z: -1 }, paints: true }
    );
  });

  test("follows an aimed block onto the stroke height", () => {
    assert.deepStrictEqual(
      createStroke().follow({ x: 2, y: 5, z: 3 }).center,
      { x: 2, y: 0, z: 3 }
    );
  });

  test("tracks the blocks it painted itself without painting from them", () => {
    const stroke = new BrushStroke({
      mode: "place",
      layerName: "Ground",
      origin: { x: 0, y: 1, z: -1 },
      aimed: { x: 0, y: 1, z: 0 }
    });
    stroke.claim(stroke.advance(stroke.origin));
    stroke.claim(stroke.advance({ x: 3, y: 1, z: -1 }));

    assert.deepStrictEqual(
      stroke.follow({ x: 1, y: 1, z: -1 }),
      { center: { x: 1, y: 1, z: -1 }, paints: false }
    );
  });

  test("keeps digging around the cells it already removed", () => {
    const stroke = new BrushStroke({
      mode: "remove",
      layerName: "Ground",
      origin: { x: 0, y: 1, z: 0 }
    });
    stroke.claim(stroke.footprintAt(stroke.origin, 3).cells());

    assert.strictEqual(stroke.claims({ x: 1, y: 1, z: 0 }), true);
    assert.deepStrictEqual(
      stroke.revisit({ x: 1, y: 1, z: 0 }),
      { center: { x: 1, y: 1, z: 0 }, paints: true }
    );
  });

  test("grows upward from its origin unless told otherwise", () => {
    assert.strictEqual(createStroke().anchor, "bottom");
    assert.strictEqual(
      new BrushStroke({
        mode: "remove",
        layerName: "Ground",
        origin: { x: 0, y: 0, z: 0 },
        anchor: "top"
      }).anchor,
      "top"
    );
  });

  test("trails a target it has not reached yet", () => {
    const stroke = createStroke();

    stroke.advance({ x: 0, y: 0, z: 0 });

    assert.strictEqual(stroke.trails({ x: 2, y: 0, z: 0 }), true);
    assert.strictEqual(stroke.trails({ x: 0, y: 0, z: 0 }), false);
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
      origin: { x: 0, y: 0, z: 4 }
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
});
