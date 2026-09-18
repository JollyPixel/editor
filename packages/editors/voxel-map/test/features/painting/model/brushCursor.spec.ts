// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import * as cursor from "../../../../src/features/painting/model/brushCursor.ts";

describe("cursor.read", () => {
  test("reads a well-formed payload", () => {
    assert.deepStrictEqual(
      cursor.read({
        position: { x: 1, y: 2, z: 3 },
        size: 2,
        axis: "xy",
        pattern: "circle"
      }),
      {
        position: { x: 1, y: 2, z: 3 },
        size: 2,
        axis: "xy",
        pattern: "circle"
      }
    );
  });

  test("reads a payload from a client without axis and pattern", () => {
    assert.deepStrictEqual(
      cursor.read({
        position: { x: 1, y: 2, z: 3 },
        size: 2
      }),
      {
        position: { x: 1, y: 2, z: 3 },
        size: 2,
        axis: "xz",
        pattern: "square"
      }
    );
  });

  test("falls back on unknown axis and pattern values", () => {
    const read = cursor.read({
      position: { x: 0, y: 0, z: 0 },
      size: 1,
      axis: "diagonal",
      pattern: 3
    });

    assert.strictEqual(read?.axis, "xz");
    assert.strictEqual(read?.pattern, "square");
  });

  test("reads the aimed face and drops an unknown one", () => {
    const base = {
      position: { x: 0, y: 0, z: 0 },
      size: 1
    };

    assert.strictEqual(cursor.read({ ...base, face: "-z" })?.face, "-z");
    assert.ok(!("face" in cursor.read({ ...base, face: "up" })!));
  });

  test("reads the anchor and drops an unknown one", () => {
    const payload = {
      position: { x: 1, y: 2, z: 3 },
      size: 2
    };

    assert.strictEqual(
      cursor.read({ ...payload, anchor: "top" })?.anchor,
      "top"
    );
    assert.strictEqual(
      cursor.read({ ...payload, anchor: "middle" })?.anchor,
      undefined
    );
  });

  test("floors a fractional size", () => {
    assert.strictEqual(
      cursor.read({
        position: { x: 0, y: 0, z: 0 },
        size: 2.7
      })!.size,
      2
    );
  });

  test("rejects anything that is not a cursor", () => {
    const rejected = [
      null,
      undefined,
      42,
      {},
      { position: { x: 0, y: 0 }, size: 1 },
      { position: { x: 0, y: 0, z: "3" }, size: 1 },
      { position: { x: 0, y: 0, z: 0 }, size: 0 },
      { position: { x: 0, y: 0, z: 0 }, size: Number.NaN },
      { position: { x: 0, y: 0, z: 0 } }
    ];

    for (const value of rejected) {
      assert.strictEqual(cursor.read(value), null);
    }
  });
});

describe("cursor.equals", () => {
  const reference: cursor.BrushCursor = {
    position: { x: 1, y: 2, z: 3 },
    size: 2,
    axis: "xz",
    pattern: "square"
  };

  test("two nulls are equal, a null and a cursor are not", () => {
    assert.ok(cursor.equals(null, null));
    assert.ok(!cursor.equals(null, reference));
    assert.ok(!cursor.equals(reference, null));
  });

  test("compares the aimed face", () => {
    assert.ok(cursor.equals(
      { ...reference, face: "+y" },
      { ...reference, face: "+y" }
    ));
    assert.ok(!cursor.equals(reference, { ...reference, face: "+y" }));
    assert.ok(!cursor.equals(
      { ...reference, face: "+y" },
      { ...reference, face: "-x" }
    ));
  });

  test("compares the anchor, a missing one standing for the bottom", () => {
    assert.ok(cursor.equals(reference, { ...reference, anchor: "bottom" }));
    assert.ok(!cursor.equals(reference, { ...reference, anchor: "top" }));
    assert.ok(!cursor.equals(
      { ...reference, anchor: "center" },
      { ...reference, anchor: "top" }
    ));
  });

  test("compares the center, size, axis and pattern", () => {
    assert.ok(cursor.equals(reference, { ...reference }));
    assert.ok(!cursor.equals(reference, { ...reference, size: 3 }));
    assert.ok(!cursor.equals(reference, { ...reference, axis: "xy" }));
    assert.ok(!cursor.equals(reference, { ...reference, pattern: "circle" }));
    assert.ok(!cursor.equals(reference, {
      ...reference,
      position: { x: 1, y: 2, z: 4 }
    }));
  });
});
