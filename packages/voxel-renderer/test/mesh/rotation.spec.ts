// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  rotateVertex,
  rotateFace,
  rotateNormal,
  flipYFace
} from "../../src/mesh/rotation.ts";
import { FACE } from "../../src/utils/math.ts";

// CONSTANTS
const kEpsilon = 1e-10;

function approxEqual(
  a: number,
  b: number
): boolean {
  return Math.abs(a - b) < kEpsilon;
}

function vecApproxEqual(
  a: readonly number[],
  b: readonly number[]
): boolean {
  return a.length === b.length && a.every((v, i) => approxEqual(v, b[i]));
}

describe("rotateFace", () => {
  it("rotation 0 is identity for every face", () => {
    for (const face of Object.values(FACE)) {
      assert.equal(rotateFace(face, 0), face);
    }
  });

  it("rot=1: PosX → NegZ", () => {
    assert.equal(rotateFace(FACE.PosX, 1), FACE.NegZ);
  });

  it("rot=1: NegX → PosZ", () => {
    assert.equal(rotateFace(FACE.NegX, 1), FACE.PosZ);
  });

  it("rot=1: PosZ → PosX", () => {
    assert.equal(rotateFace(FACE.PosZ, 1), FACE.PosX);
  });

  it("rot=1: NegZ → NegX", () => {
    assert.equal(rotateFace(FACE.NegZ, 1), FACE.NegX);
  });

  it("rot=1: Y faces are unchanged", () => {
    assert.equal(rotateFace(FACE.PosY, 1), FACE.PosY);
    assert.equal(rotateFace(FACE.NegY, 1), FACE.NegY);
  });

  it("rot=2: PosX → NegX (180°)", () => {
    assert.equal(rotateFace(FACE.PosX, 2), FACE.NegX);
    assert.equal(rotateFace(FACE.PosZ, 2), FACE.NegZ);
  });

  it("rot=4 wraps to identity (& 0b11 masking)", () => {
    for (const face of Object.values(FACE)) {
      assert.equal(rotateFace(face, 4), rotateFace(face, 0));
    }
  });
});

describe("rotateVertex", () => {
  it("rotation 0 with no flips is identity", () => {
    const v = [0.3, 0.7, 0.2] as const;
    const result = rotateVertex([...v], 0, { x: false, z: false });
    assert.deepEqual(result, [...v]);
  });

  it("block center [0.5,0.5,0.5] is invariant under any rotation", () => {
    for (let r = 0; r < 4; r++) {
      const result = rotateVertex([0.5, 0.5, 0.5], r, { x: false, z: false });
      assert.ok(vecApproxEqual(result, [0.5, 0.5, 0.5]), `center not invariant at rotation ${r}`);
    }
  });

  it("rot=1: [1,0,0] → [0,0,0]", () => {
    assert.deepEqual(rotateVertex([1, 0, 0], 1, { x: false, z: false }), [0, 0, 0]);
  });

  it("rot=1: [0,0,0] → [0,0,1]", () => {
    assert.deepEqual(rotateVertex([0, 0, 0], 1, { x: false, z: false }), [0, 0, 1]);
  });

  it("rot=1: [0,0,1] → [1,0,1]", () => {
    assert.deepEqual(rotateVertex([0, 0, 1], 1, { x: false, z: false }), [1, 0, 1]);
  });

  it("rot=1: [1,0,1] → [1,0,0]", () => {
    assert.deepEqual(rotateVertex([1, 0, 1], 1, { x: false, z: false }), [1, 0, 0]);
  });

  it("rot=2: [1,0,0] → [0,0,1] (180° maps each corner to its diagonally opposite)", () => {
    assert.deepEqual(rotateVertex([1, 0, 0], 2, { x: false, z: false }), [0, 0, 1]);
  });

  it("rot=2: [0,0,0] → [1,0,1]", () => {
    assert.deepEqual(rotateVertex([0, 0, 0], 2, { x: false, z: false }), [1, 0, 1]);
  });

  it("flipX mirrors x around 0.5", () => {
    const result = rotateVertex([1, 0, 0], 0, { x: true, z: false });
    assert.deepEqual(result, [0, 0, 0]);
  });

  it("flipZ mirrors z around 0.5", () => {
    const result = rotateVertex([0, 0, 0.2], 0, { x: false, z: true });
    assert.ok(approxEqual(result[2], 0.8));
  });

  it("Y coordinate is unchanged when flipY is not set", () => {
    const result = rotateVertex([0.3, 0.7, 0.2], 3, { x: true, z: true });
    assert.ok(approxEqual(result[1], 0.7));
  });
});

describe("rotateVertex with flipY", () => {
  it("flipY mirrors y around 0.5", () => {
    const result = rotateVertex([0.3, 0.7, 0.2], 0, { x: false, z: false, y: true });
    assert.ok(approxEqual(result[0], 0.3));
    assert.ok(approxEqual(result[1], 0.3));
    assert.ok(approxEqual(result[2], 0.2));
  });

  it("block center [0.5,0.5,0.5] is invariant under flipY", () => {
    const result = rotateVertex([0.5, 0.5, 0.5], 0, { x: false, z: false, y: true });
    assert.ok(vecApproxEqual(result, [0.5, 0.5, 0.5]));
  });

  it("flipY composes with rotation: rot=1 then flipY", () => {
    // rot=1: [0,0,0] → [0,0,1]; then flipY: y stays 0 → 1-0=1
    const result = rotateVertex([0, 0, 0], 1, { x: false, z: false, y: true });
    assert.ok(vecApproxEqual(result, [0, 1, 1]));
  });
});

describe("rotateNormal", () => {
  it("rotation 0 with no flips is identity", () => {
    assert.deepEqual(rotateNormal([1, 0, 0], 0, { flipX: false, flipZ: false }), [1, 0, 0]);
  });

  it("rot=1: [1,0,0] → [0,0,-1]", () => {
    const result = rotateNormal([1, 0, 0], 1, { flipX: false, flipZ: false });
    assert.ok(vecApproxEqual(result, [0, 0, -1]));
  });

  it("rot=1: [0,0,1] → [1,0,0]", () => {
    const result = rotateNormal([0, 0, 1], 1, { flipX: false, flipZ: false });
    assert.ok(vecApproxEqual(result, [1, 0, 0]));
  });

  it("rot=2: [1,0,0] → [-1,0,0]", () => {
    const result = rotateNormal([1, 0, 0], 2, { flipX: false, flipZ: false });
    assert.ok(vecApproxEqual(result, [-1, 0, 0]));
  });

  it("flipX negates nx component", () => {
    const result = rotateNormal([0.5, 0, 0.5], 0, { flipX: true, flipZ: false });
    assert.ok(vecApproxEqual(result, [-0.5, 0, 0.5]));
  });

  it("flipZ negates nz component", () => {
    const result = rotateNormal([0, 0, 1], 0, { flipX: false, flipZ: true });
    assert.ok(vecApproxEqual(result, [0, 0, -1]));
  });

  it("Y component is unchanged when flipY is not set", () => {
    const result = rotateNormal([0, 0.7, 0], 2, { flipX: true, flipZ: true });
    assert.ok(approxEqual(result[1], 0.7));
  });
});

describe("rotateNormal with flipY", () => {
  it("flipY negates ny component", () => {
    const result = rotateNormal([0, 0.7, 0], 0, { flipX: false, flipZ: false, flipY: true });
    assert.ok(approxEqual(result[0], 0));
    assert.ok(approxEqual(result[1], -0.7));
    assert.ok(approxEqual(result[2], 0));
  });

  it("X and Z components are unchanged by flipY alone", () => {
    const result = rotateNormal([0.5, 0.3, 0.4], 0, { flipX: false, flipZ: false, flipY: true });
    assert.ok(approxEqual(result[0], 0.5));
    assert.ok(approxEqual(result[2], 0.4));
  });
});

describe("flipYFace", () => {
  it("PosY → NegY", () => {
    assert.equal(flipYFace(FACE.PosY), FACE.NegY);
  });

  it("NegY → PosY", () => {
    assert.equal(flipYFace(FACE.NegY), FACE.PosY);
  });

  it("all other faces pass through unchanged", () => {
    assert.equal(flipYFace(FACE.PosX), FACE.PosX);
    assert.equal(flipYFace(FACE.NegX), FACE.NegX);
    assert.equal(flipYFace(FACE.PosZ), FACE.PosZ);
    assert.equal(flipYFace(FACE.NegZ), FACE.NegZ);
  });
});
