// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { packTransform, unpackTransform, FACE } from "../../src/utils/math.ts";

describe("packTransform / unpackTransform", () => {
  it("round-trips all 16 rotation×flip combinations", () => {
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

  it("encodes all bits simultaneously", () => {
    assert.equal(packTransform(3, true, true), 0b1111);
  });

  it("unpackTransform treats unknown high bits as irrelevant", () => {
    // Extra bits beyond bit 3 are masked away for rotation.
    const result = unpackTransform(0b11 | 0b100 | 0b1000);
    assert.equal(result.rotation, 3);
    assert.equal(result.flipX, true);
    assert.equal(result.flipZ, true);
  });
});

describe("FACE constant", () => {
  it("has exactly 6 distinct values 0–5", () => {
    const values = Object.values(FACE);
    assert.equal(values.length, 6);
    assert.deepEqual(new Set(values), new Set([0, 1, 2, 3, 4, 5]));
  });
});
