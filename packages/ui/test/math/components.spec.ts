// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  copyComponents,
  snapshotComponents
} from "../../src/math/components.ts";
import { Mixed } from "../../src/field/mixed.ts";

describe("Math.components.snapshotComponents", () => {
  test("keeps only the numeric axes a value carries", () => {
    assert.deepEqual(
      snapshotComponents({ x: 1, y: 2, z: 3 }),
      { x: 1, y: 2, z: 3 }
    );
    assert.deepEqual(
      snapshotComponents({ x: 1, y: 2 }),
      { x: 1, y: 2 }
    );
  });

  test("drops methods, so the result is a plain record", () => {
    class Vector {
      x = 1;
      y = 2;
      z = 3;
      clone(): Vector {
        return new Vector();
      }
    }
    const snapshot = snapshotComponents(new Vector());

    assert.deepEqual(snapshot, { x: 1, y: 2, z: 3 });
    assert.equal(Object.getPrototypeOf(snapshot), Object.prototype);
  });

  test("returns a fresh object every call", () => {
    const value = { x: 1, y: 2, z: 3 };

    assert.notEqual(
      snapshotComponents(value),
      snapshotComponents(value)
    );
  });

  test("skips a Mixed axis", () => {
    assert.deepEqual(
      snapshotComponents({ x: 1, y: Mixed, z: 3 }),
      { x: 1, z: 3 }
    );
  });

  test("recurses one level into a transform", () => {
    assert.deepEqual(
      snapshotComponents({
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 }
      }),
      {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 }
      }
    );
  });

  test("passes a primitive straight through", () => {
    assert.equal(snapshotComponents(4), 4);
    assert.equal(snapshotComponents(null), null);
  });
});

describe("Math.components.copyComponents", () => {
  test("writes into the target and keeps its identity", () => {
    class Vector {
      x = 0;
      y = 0;
      z = 0;
    }
    const target = new Vector();

    copyComponents(target, { x: 1, y: 2, z: 3 });

    assert.deepEqual(
      { x: target.x, y: target.y, z: target.z },
      { x: 1, y: 2, z: 3 }
    );
    assert.ok(target instanceof Vector);
  });

  test("leaves an axis the target does not carry", () => {
    const target: Record<string, number> = { x: 0, y: 0 };

    copyComponents(target, { x: 1, y: 2, z: 3 });

    assert.deepEqual(target, { x: 1, y: 2 });
  });

  test("skips a Mixed axis", () => {
    const target = { x: 0, y: 0, z: 0 };

    copyComponents(target, { x: 1, y: Mixed, z: 3 });

    assert.deepEqual(target, { x: 1, y: 0, z: 3 });
  });

  test("copies each transform sub-value in place", () => {
    const position = { x: 0, y: 0, z: 0 };
    const target = {
      position,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    };

    copyComponents(target, {
      position: { x: 4, y: 5, z: 6 },
      rotation: { x: 0, y: 1, z: 0, w: 0 },
      scale: { x: 2, y: 2, z: 2 }
    });

    assert.equal(target.position, position);
    assert.deepEqual(position, { x: 4, y: 5, z: 6 });
    assert.deepEqual(target.scale, { x: 2, y: 2, z: 2 });
  });

  test("ignores a primitive on either side", () => {
    const target = { x: 0, y: 0 };

    copyComponents(target, null);
    copyComponents(4, { x: 1, y: 2 });

    assert.deepEqual(target, { x: 0, y: 0 });
  });
});
