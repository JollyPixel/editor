// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { DEFAULT_UV_SLOTS } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  BLOCK_SHAPE_PARAMETERS,
  BlockShape
} from "#src/model/nodes/BlockShape.ts";

describe("BlockShape", () => {
  test("names one UV slot per face: six for a box, the top of a plane, one per side plus caps", () => {
    assert.deepEqual(BlockShape.slots({ type: "box" }), [...DEFAULT_UV_SLOTS]);
    assert.deepEqual(BlockShape.slots({ type: "plane" }), ["top"]);
    assert.deepEqual(
      BlockShape.slots({ type: "cylinder", sides: 3 }),
      ["side-0", "side-1", "side-2", "top", "bottom"]
    );
    assert.deepEqual(
      BlockShape.slots({ type: "cone", sides: 4 }),
      ["side-0", "side-1", "side-2", "side-3", "bottom"]
    );
    assert.deepEqual(
      BlockShape.slots({ type: "torus", sides: 3, ringSides: 12, thickness: 0.5 }),
      ["side-0", "side-1", "side-2"]
    );
  });

  test("creates round shapes with their default sides, ring sides and thickness", () => {
    const { sides, ringSides, thickness } = BLOCK_SHAPE_PARAMETERS;

    assert.deepEqual(BlockShape.create("cylinder"), { type: "cylinder", sides: sides.default });
    assert.deepEqual(BlockShape.create("torus"), {
      type: "torus",
      sides: sides.default,
      ringSides: ringSides.default,
      thickness: thickness.default
    });
    assert.deepEqual(BlockShape.create("plane"), { type: "plane" });
  });

  test("lists only the parameters a shape has, with their ranges", () => {
    assert.deepEqual(BlockShape.parameters({ type: "box" }), []);
    const torus = BlockShape.parameters({ type: "torus", sides: 5, ringSides: 7, thickness: 0.4 });
    assert.deepEqual(
      torus.map(({ key, value }) => [key, value]),
      [["sides", 5], ["ringSides", 7], ["thickness", 0.4]]
    );
    assert.deepEqual(BlockShape.parameters({ type: "cone", sides: 4 }), [
      { key: "sides", value: 4, ...BLOCK_SHAPE_PARAMETERS.sides }
    ]);
  });

  test("sets a parameter snapped to its step and clamped to its range, rejecting one the shape lacks", () => {
    const torus = { type: "torus", sides: 8, ringSides: 6, thickness: 0.35 } as const;

    assert.deepEqual(BlockShape.withParameter(torus, "sides", 4.6), { ...torus, sides: 5 });
    assert.deepEqual(BlockShape.withParameter(torus, "ringSides", 99), { ...torus, ringSides: 32 });
    assert.deepEqual(BlockShape.withParameter(torus, "thickness", 0.62), { ...torus, thickness: 0.6 });
    assert.deepEqual(BlockShape.withParameter(torus, "thickness", 0.01), { ...torus, thickness: 0.05 });
    const cone = { type: "cone", sides: 4 } as const;
    assert.throws(() => BlockShape.withParameter(cone, "thickness", 0.5), RangeError);
  });

  test("tells round and pointed shapes and side slots apart", () => {
    assert.equal(BlockShape.isRound({ type: "cylinder", sides: 3 }), true);
    assert.equal(BlockShape.isRound({ type: "plane" }), false);
    assert.equal(BlockShape.isPointed({ type: "cone", sides: 4 }), true);
    assert.equal(BlockShape.isPointed({ type: "cylinder", sides: 4 }), false);
    assert.equal(BlockShape.isSideSlot("side-12"), true);
    assert.equal(BlockShape.isSideSlot("top"), false);
  });

  test("tells shapes apart by their sides as well as their type", () => {
    assert.equal(BlockShape.same({ type: "cone", sides: 4 }, { type: "cone", sides: 4 }), true);
    assert.equal(BlockShape.same({ type: "cone", sides: 4 }, { type: "cone", sides: 8 }), false);
    assert.equal(BlockShape.same({ type: "cone", sides: 4 }, { type: "cylinder", sides: 4 }), false);
    assert.equal(BlockShape.same({ type: "box" }, { type: "plane" }), false);
  });
});
