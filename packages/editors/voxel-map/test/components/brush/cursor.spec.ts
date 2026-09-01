// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import * as cursor from "../../../src/components/brush/cursor.ts";

describe("cursor.cellsOf", () => {
  test("a size of 1 covers the center cell alone", () => {
    const cells = cursor.cellsOf({
      position: { x: 4, y: 2, z: -1 },
      size: 1
    });

    assert.deepStrictEqual(cells, [{ x: 4, y: 2, z: -1 }]);
  });

  test("spreads a square on the plane of the center cell", () => {
    const cells = cursor.cellsOf({
      position: { x: 0, y: 5, z: 0 },
      size: 3
    });

    assert.strictEqual(cells.length, 9);
    assert.ok(cells.every((cell) => cell.y === 5));
    assert.deepStrictEqual(
      cells.map((cell) => [cell.x, cell.z]),
      [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 0], [0, 1],
        [1, -1], [1, 0], [1, 1]
      ]
    );
  });

  test("an even size leans towards the positive axes", () => {
    const cells = cursor.cellsOf({
      position: { x: 0, y: 0, z: 0 },
      size: 2
    });

    assert.deepStrictEqual(
      cells.map((cell) => [cell.x, cell.z]),
      [[-1, -1], [-1, 0], [0, -1], [0, 0]]
    );
  });
});

describe("cursor.read", () => {
  test("reads a well-formed payload", () => {
    assert.deepStrictEqual(
      cursor.read({
        position: { x: 1, y: 2, z: 3 },
        size: 2
      }),
      {
        position: { x: 1, y: 2, z: 3 },
        size: 2
      }
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
  const reference = {
    position: { x: 1, y: 2, z: 3 },
    size: 2
  };

  test("two nulls are equal, a null and a cursor are not", () => {
    assert.ok(cursor.equals(null, null));
    assert.ok(!cursor.equals(null, reference));
    assert.ok(!cursor.equals(reference, null));
  });

  test("compares the center and the size", () => {
    assert.ok(cursor.equals(reference, { ...reference }));
    assert.ok(!cursor.equals(reference, { ...reference, size: 3 }));
    assert.ok(!cursor.equals(reference, {
      ...reference,
      position: { x: 1, y: 2, z: 4 }
    }));
  });
});
