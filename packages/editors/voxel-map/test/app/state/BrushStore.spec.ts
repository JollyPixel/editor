// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  BRUSH_MAX_SIZE,
  BRUSH_MIN_SIZE,
  BrushStore
} from "../../../src/app/state/BrushStore.ts";

describe("BrushStore.size", () => {
  test("reaches sixteen", () => {
    const brush = new BrushStore();
    brush.size = 16;

    assert.strictEqual(brush.size, 16);
    assert.strictEqual(BRUSH_MAX_SIZE, 16);
  });

  test("clamps between the minimum and maximum size", () => {
    const brush = new BrushStore();

    brush.size = 40;
    assert.strictEqual(brush.size, BRUSH_MAX_SIZE);

    brush.size = -3;
    assert.strictEqual(brush.size, BRUSH_MIN_SIZE);
  });

  test("resize stops at the maximum size", () => {
    const brush = new BrushStore();
    const sizes: number[] = [];
    brush.subscribe("sizeChange", (size) => sizes.push(size));

    brush.size = BRUSH_MAX_SIZE - 1;
    brush.resize(1);
    brush.resize(1);

    assert.deepStrictEqual(sizes, [BRUSH_MAX_SIZE - 1, BRUSH_MAX_SIZE]);
  });
});

describe("BrushStore.ghost", () => {
  test("starts disabled", () => {
    assert.strictEqual(new BrushStore().ghost, false);
  });

  test("emits once per actual change", () => {
    const brush = new BrushStore();
    const changes: boolean[] = [];
    brush.subscribe("ghostChange", (ghost) => changes.push(ghost));

    brush.ghost = true;
    brush.ghost = true;
    brush.ghost = false;

    assert.deepStrictEqual(changes, [true, false]);
  });
});
