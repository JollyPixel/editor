// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { compoundOutline } from "../../src/uv/compoundOutline.ts";
import type { UVCompoundPart } from "../../src/uv/types.ts";
import type { Vec2 } from "../../src/types.ts";

/*
 * CONSTANTS
 * The two quads a stair emits for its side slot, an L open at the top left.
 */
const kStairSide: readonly UVCompoundPart[] = [
  { x: 0, y: 0.5, width: 1, height: 0.5 },
  { x: 0.5, y: 0, width: 0.5, height: 0.5 }
];

/**
 * Rotates a loop so it starts at its lowest key, making a comparison
 * independent of where the walk began.
 */
function normalize(
  loop: readonly Vec2[]
): Vec2[] {
  const keys = loop.map((point) => `${point.x},${point.y}`);
  const start = keys.indexOf([...keys].sort()[0]);

  return [...loop.slice(start), ...loop.slice(0, start)].map((point) => {
    return {
      x: point.x,
      y: point.y
    };
  });
}

describe("compoundOutline", () => {
  test("drops the edge two rectangles share, leaving one L loop", () => {
    const loops = compoundOutline(kStairSide);

    assert.ok(loops, "the parts stitch into loops");
    assert.strictEqual(loops.length, 1);
    assert.deepStrictEqual(
      normalize(loops[0]),
      [
        { x: 0, y: 0.5 },
        { x: 0.5, y: 0.5 },
        { x: 0.5, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ]
    );
  });

  test("drops the diagonal two triangles share, leaving the full square", () => {
    const loops = compoundOutline([
      {
        shape: "triangle",
        corner: "top-left",
        rect: { x: 0, y: 0, width: 1, height: 1 }
      },
      {
        shape: "triangle",
        corner: "bottom-right",
        rect: { x: 0, y: 0, width: 1, height: 1 }
      }
    ]);

    assert.ok(loops, "the parts stitch into loops");
    assert.strictEqual(loops.length, 1);
    assert.deepStrictEqual(
      normalize(loops[0]),
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ]
    );
  });

  test("merges three quarters into a square missing one corner", () => {
    const loops = compoundOutline([
      { x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0, width: 0.5, height: 0.5 }
    ]);

    assert.ok(loops, "the parts stitch into loops");
    assert.strictEqual(loops.length, 1);
    assert.deepStrictEqual(
      normalize(loops[0]),
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 0.5 },
        { x: 0.5, y: 0.5 },
        { x: 0.5, y: 1 },
        { x: 0, y: 1 }
      ]
    );
  });

  test("keeps a triangle joined to a rectangle along its leg as one loop", () => {
    const loops = compoundOutline([
      { x: 0, y: 0.5, width: 1, height: 0.5 },
      {
        shape: "triangle",
        corner: "bottom-left",
        rect: { x: 0, y: 0, width: 1, height: 0.5 }
      }
    ]);

    assert.ok(loops, "the parts stitch into loops");
    assert.strictEqual(loops.length, 1);
    assert.deepStrictEqual(
      normalize(loops[0]),
      [
        { x: 0, y: 0 },
        { x: 1, y: 0.5 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ]
    );
  });

  test("traces a hole as its own loop", () => {
    const loops = compoundOutline([
      { x: 0, y: 0, width: 1, height: 0.25 },
      { x: 0, y: 0.75, width: 1, height: 0.25 },
      { x: 0, y: 0.25, width: 0.25, height: 0.5 },
      { x: 0.75, y: 0.25, width: 0.25, height: 0.5 }
    ]);

    assert.ok(loops, "the parts stitch into loops");
    assert.strictEqual(loops.length, 2);

    const [outer, hole] = loops.map(normalize).sort(
      (a, b) => a[0].x - b[0].x
    );
    assert.deepStrictEqual(outer, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ]);
    // Counter-clockwise, so the nonzero fill rule reads it as a hole.
    assert.deepStrictEqual(hole, [
      { x: 0.25, y: 0.25 },
      { x: 0.25, y: 0.75 },
      { x: 0.75, y: 0.75 },
      { x: 0.75, y: 0.25 }
    ]);
  });

  test("keeps parts touching by a single corner in separate loops", () => {
    const loops = compoundOutline([
      { x: 0, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }
    ]);

    assert.ok(loops, "the parts stitch into loops");
    assert.strictEqual(loops.length, 2);
    assert.deepStrictEqual(
      loops.map((loop) => loop.length),
      [4, 4]
    );
  });

  test("outlines overlapping parts one by one, as they were drawn before", () => {
    const loops = compoundOutline([
      { x: 0, y: 0, width: 0.75, height: 0.75 },
      { x: 0.25, y: 0.25, width: 0.75, height: 0.75 }
    ]);

    assert.ok(loops, "the parts stitch into loops");
    assert.deepStrictEqual(
      loops.map(normalize),
      [
        [
          { x: 0, y: 0 },
          { x: 0.75, y: 0 },
          { x: 0.75, y: 0.75 },
          { x: 0, y: 0.75 }
        ],
        [
          { x: 0.25, y: 0.25 },
          { x: 1, y: 0.25 },
          { x: 1, y: 1 },
          { x: 0.25, y: 1 }
        ]
      ]
    );
  });

  test("returns null without parts", () => {
    assert.strictEqual(compoundOutline([]), null);
  });
});
