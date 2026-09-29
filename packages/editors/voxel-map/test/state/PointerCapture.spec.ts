// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { PointerCapture } from "../../src/state/PointerCapture.ts";

describe("PointerCapture", () => {
  test("stays captured until every owner releases", () => {
    const pointer = new PointerCapture();
    const gizmo = {};
    const box = {};
    const changes: boolean[] = [];
    pointer.subscribe("change", (captured) => changes.push(captured));

    pointer.capture(gizmo);
    pointer.capture(box);
    pointer.release(gizmo);

    assert.equal(pointer.captured, true);

    pointer.release(box);

    assert.equal(pointer.captured, false);
    assert.deepEqual(changes, [true, false]);
  });

  test("ignores a release from an owner that never captured", () => {
    const pointer = new PointerCapture();
    const changes: boolean[] = [];
    pointer.subscribe("change", (captured) => changes.push(captured));
    pointer.capture({});

    pointer.release({});

    assert.equal(pointer.captured, true);
    assert.deepEqual(changes, [true]);
  });
});
