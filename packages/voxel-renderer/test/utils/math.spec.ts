// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  clamp,
  FACE,
  FACE_NORMALS,
  FACE_OFFSETS,
  FACE_OPPOSITE
} from "../../src/utils/math.ts";
import { EPSILON } from "../helpers/math.ts";

describe("clamp", () => {
  it("returns the value unchanged when within range", () => {
    assert.equal(clamp(0, 1, 0.5), 0.5);
  });

  it("clamps a value above max down to max", () => {
    assert.equal(clamp(0, 1, 5), 1);
  });

  it("clamps a value below min up to min", () => {
    assert.equal(clamp(0, 1, -5), 0);
  });

  it("returns the boundary values unchanged", () => {
    assert.equal(clamp(0, 1, 0), 0);
    assert.equal(clamp(0, 1, 1), 1);
  });
});

describe("FACE constant", () => {
  it("has exactly 6 distinct values 0–5", () => {
    const values = Object.values(FACE);
    assert.equal(values.length, 6);
    assert.deepEqual(new Set(values), new Set([0, 1, 2, 3, 4, 5]));
  });
});

describe("FACE_NORMALS", () => {
  it("has 6 entries", () => {
    assert.equal(FACE_NORMALS.length, 6);
  });

  it("each entry is a unit vector", () => {
    for (const [i, n] of FACE_NORMALS.entries()) {
      const len = Math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2);
      assert.ok(Math.abs(len - 1) < EPSILON, `FACE_NORMALS[${i}] is not a unit vector`);
    }
  });

  it("PosX normal is [1,0,0]", () => {
    assert.deepEqual(FACE_NORMALS[FACE.PosX], [1, 0, 0]);
  });

  it("NegY normal is [0,-1,0]", () => {
    assert.deepEqual(FACE_NORMALS[FACE.NegY], [0, -1, 0]);
  });
});

describe("FACE_OFFSETS", () => {
  it("equals FACE_NORMALS (same axis-aligned values)", () => {
    for (let i = 0; i < 6; i++) {
      assert.deepEqual(FACE_OFFSETS[i], FACE_NORMALS[i]);
    }
  });
});

describe("FACE_OPPOSITE", () => {
  it("has 6 entries", () => {
    assert.equal(FACE_OPPOSITE.length, 6);
  });

  it("is involutive: opposite(opposite(f)) === f", () => {
    for (let f = 0; f < 6; f++) {
      assert.equal(FACE_OPPOSITE[FACE_OPPOSITE[f]], f, `double opposite of face ${f} should be itself`);
    }
  });

  it("PosX opposite is NegX and vice versa", () => {
    assert.equal(FACE_OPPOSITE[FACE.PosX], FACE.NegX);
    assert.equal(FACE_OPPOSITE[FACE.NegX], FACE.PosX);
  });

  it("PosY opposite is NegY and vice versa", () => {
    assert.equal(FACE_OPPOSITE[FACE.PosY], FACE.NegY);
    assert.equal(FACE_OPPOSITE[FACE.NegY], FACE.PosY);
  });

  it("PosZ opposite is NegZ and vice versa", () => {
    assert.equal(FACE_OPPOSITE[FACE.PosZ], FACE.NegZ);
    assert.equal(FACE_OPPOSITE[FACE.NegZ], FACE.PosZ);
  });
});
