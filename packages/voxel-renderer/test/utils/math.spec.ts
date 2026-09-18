// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  clamp,
  FACE,
  FACES,
  FACE_NORMALS,
  FACE_OFFSETS,
  FACE_OPPOSITE
} from "../../src/utils/math.ts";

describe("clamp", () => {
  for (const [value, expected] of [[0.5, 0.5], [5, 1], [-5, 0], [0, 0], [1, 1]]) {
    it(`clamps ${value} into [0, 1] as ${expected}`, () => {
      assert.equal(clamp(0, 1, value), expected);
    });
  }
});

describe("face tables", () => {
  it("numbers the six faces 0 to 5", () => {
    assert.deepEqual([...FACES].sort(), [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(new Set(Object.values(FACE)), new Set(FACES));
  });

  it("gives each face an axis-aligned unit normal, shared by its offset", () => {
    for (const face of FACES) {
      const normal = FACE_NORMALS[face];

      assert.equal(normal.filter((component) => component !== 0).length, 1, `face ${face}`);
      assert.equal(Math.abs(normal[0] + normal[1] + normal[2]), 1, `face ${face}`);
      assert.deepEqual(FACE_OFFSETS[face], normal);
    }
    assert.deepEqual(FACE_NORMALS[FACE.PosX], [1, 0, 0]);
    assert.deepEqual(FACE_NORMALS[FACE.NegY], [0, -1, 0]);
  });

  it("pairs every face with the one whose normal it negates", () => {
    for (const face of FACES) {
      const opposite = FACE_OPPOSITE[face];

      assert.equal(FACE_OPPOSITE[opposite], face);
      assert.deepEqual(
        FACE_NORMALS[opposite],
        FACE_NORMALS[face].map((component) => -component || 0)
      );
    }
  });
});
