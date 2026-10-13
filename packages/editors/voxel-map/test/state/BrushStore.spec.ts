// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  BRUSH_MAX_SIZE,
  BRUSH_MIN_SIZE,
  BrushStore
} from "../../src/state/BrushStore.ts";

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
    brush.subscribe("change", ({ size }) => sizes.push(size));

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
    brush.subscribe("change", ({ ghost }) => changes.push(ghost));

    brush.ghost = true;
    brush.ghost = true;
    brush.ghost = false;

    assert.deepStrictEqual(changes, [true, false]);
  });
});

describe("BrushStore.suspended", () => {
  test("starts painting-ready", () => {
    assert.strictEqual(new BrushStore().suspended, false);
  });

  test("emits once per actual change", () => {
    const brush = new BrushStore();
    const changes: boolean[] = [];
    brush.subscribe("suspendedChange", (suspended) => changes.push(suspended));

    brush.suspended = true;
    brush.suspended = true;
    brush.suspended = false;

    assert.deepStrictEqual(changes, [true, false]);
  });
});

describe("BrushStore storage", () => {
  test("falls back field by field on invalid stored options", () => {
    const storage = new MemoryStorageAdapter();
    storage.set("voxel-map:brush", JSON.stringify({
      size: 99,
      rotationMode: 5,
      mode: "replace",
      pattern: "star",
      ghost: "yes",
      skyRadius: -4
    }));
    const brush = new BrushStore(storage);

    assert.strictEqual(brush.size, BRUSH_MAX_SIZE);
    assert.strictEqual(brush.rotationMode, "auto");
    assert.strictEqual(brush.mode, "replace");
    assert.strictEqual(brush.pattern, "square");
    assert.strictEqual(brush.ghost, false);
    assert.strictEqual(brush.skyRadius, 0);
  });

  test("starts from the defaults when the stored value is not JSON", () => {
    const storage = new MemoryStorageAdapter();
    storage.set("voxel-map:brush", "{not json");

    const brush = new BrushStore(storage);

    assert.strictEqual(brush.size, BRUSH_MIN_SIZE);
    assert.strictEqual(brush.skyRadius, 24);
  });
});
