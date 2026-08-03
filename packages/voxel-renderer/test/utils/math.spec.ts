// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  packTransform,
  unpackTransform,
  clamp,
  FACE,
  FACE_NORMALS,
  FACE_OFFSETS,
  FACE_OPPOSITE
} from "../../src/utils/math.ts";

// CONSTANTS
const kEpsilon = 1e-10;

describe("packTransform / unpackTransform", () => {
  it("round-trips all 16 rotation×flip combinations (no flipY)", () => {
    const rotations = [0, 1, 2, 3] as const;
    const bools = [false, true];

    for (const rotation of rotations) {
      for (const flipX of bools) {
        for (const flipZ of bools) {
          const packed = packTransform(rotation, flipX, flipZ);
          const result = unpackTransform(packed);

          assert.equal(result.rotation, rotation, `rotation mismatch for ${rotation},${flipX},${flipZ}`);
          assert.equal(result.flipX, flipX, `flipX mismatch for ${rotation},${flipX},${flipZ}`);
          assert.equal(result.flipZ, flipZ, `flipZ mismatch for ${rotation},${flipX},${flipZ}`);
          assert.equal(result.flipY, false, `flipY should be false for ${rotation},${flipX},${flipZ}`);
        }
      }
    }
  });

  it("round-trips all 32 rotation×flip combinations (including flipY)", () => {
    const rotations = [0, 1, 2, 3] as const;
    const bools = [false, true];

    for (const rotation of rotations) {
      for (const flipX of bools) {
        for (const flipZ of bools) {
          for (const flipY of bools) {
            const packed = packTransform(rotation, flipX, flipZ, flipY);
            const result = unpackTransform(packed);

            assert.equal(result.rotation, rotation, `rotation mismatch for ${rotation},${flipX},${flipZ},${flipY}`);
            assert.equal(result.flipX, flipX, `flipX mismatch for ${rotation},${flipX},${flipZ},${flipY}`);
            assert.equal(result.flipZ, flipZ, `flipZ mismatch for ${rotation},${flipX},${flipZ},${flipY}`);
            assert.equal(result.flipY, flipY, `flipY mismatch for ${rotation},${flipX},${flipZ},${flipY}`);
          }
        }
      }
    }
  });

  it("packs default (no rotation, no flip) to 0", () => {
    assert.equal(packTransform(0, false, false), 0);
  });

  it("encodes rotation in bits 0–1", () => {
    assert.equal(packTransform(1, false, false), 0b001);
    assert.equal(packTransform(2, false, false), 0b010);
    assert.equal(packTransform(3, false, false), 0b011);
  });

  it("encodes flipX in bit 2", () => {
    assert.equal(packTransform(0, true, false), 0b100);
  });

  it("encodes flipZ in bit 3", () => {
    assert.equal(packTransform(0, false, true), 0b1000);
  });

  it("encodes flipY in bit 4", () => {
    assert.equal(packTransform(0, false, false, true), 0b10000);
  });

  it("encodes all bits simultaneously", () => {
    assert.equal(packTransform(3, true, true), 0b1111);
    assert.equal(packTransform(3, true, true, true), 0b11111);
  });

  it("unpackTransform treats unknown high bits as irrelevant", () => {
    // Extra bits beyond bit 3 are masked away for rotation.
    const result = unpackTransform(0b11 | 0b100 | 0b1000);
    assert.equal(result.rotation, 3);
    assert.equal(result.flipX, true);
    assert.equal(result.flipZ, true);
  });
});

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
      assert.ok(Math.abs(len - 1) < kEpsilon, `FACE_NORMALS[${i}] is not a unit vector`);
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
