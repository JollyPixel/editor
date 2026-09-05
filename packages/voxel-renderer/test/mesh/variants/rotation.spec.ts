// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  rotateVertex,
  rotateFace,
  rotateNormal,
  flipYFace
} from "../../../src/mesh/variants/rotation.ts";
import { FACE } from "../../../src/utils/math.ts";
import { VoxelTransform } from "../../../src/world/index.ts";
import { approxEqual } from "../../helpers/math.ts";

function tf(
  rotation: number,
  flipX = false,
  flipZ = false,
  flipY = false
): VoxelTransform {
  return new VoxelTransform({ rotation, flipX, flipZ, flipY });
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
    const result = rotateVertex([...v], tf(0));
    assert.deepEqual(result, [...v]);
  });

  it("block center [0.5,0.5,0.5] is invariant under any rotation", () => {
    for (let r = 0; r < 4; r++) {
      const result = rotateVertex([0.5, 0.5, 0.5], tf(r));
      assert.ok(vecApproxEqual(result, [0.5, 0.5, 0.5]), `center not invariant at rotation ${r}`);
    }
  });

  it("rot=1: [1,0,0] → [0,0,0]", () => {
    assert.deepEqual(rotateVertex([1, 0, 0], tf(1)), [0, 0, 0]);
  });

  it("rot=1: [0,0,0] → [0,0,1]", () => {
    assert.deepEqual(rotateVertex([0, 0, 0], tf(1)), [0, 0, 1]);
  });

  it("rot=1: [0,0,1] → [1,0,1]", () => {
    assert.deepEqual(rotateVertex([0, 0, 1], tf(1)), [1, 0, 1]);
  });

  it("rot=1: [1,0,1] → [1,0,0]", () => {
    assert.deepEqual(rotateVertex([1, 0, 1], tf(1)), [1, 0, 0]);
  });

  it("rot=2: [1,0,0] → [0,0,1] (180° maps each corner to its diagonally opposite)", () => {
    assert.deepEqual(rotateVertex([1, 0, 0], tf(2)), [0, 0, 1]);
  });

  it("rot=2: [0,0,0] → [1,0,1]", () => {
    assert.deepEqual(rotateVertex([0, 0, 0], tf(2)), [1, 0, 1]);
  });

  it("flipX mirrors x around 0.5", () => {
    const result = rotateVertex([1, 0, 0], tf(0, true, false));
    assert.deepEqual(result, [0, 0, 0]);
  });

  it("flipZ mirrors z around 0.5", () => {
    const result = rotateVertex([0, 0, 0.2], tf(0, false, true));
    assert.ok(approxEqual(result[2], 0.8));
  });

  it("Y coordinate is unchanged when flipY is not set", () => {
    const result = rotateVertex([0.3, 0.7, 0.2], tf(3, true, true));
    assert.ok(approxEqual(result[1], 0.7));
  });
});

describe("rotateVertex with flipY", () => {
  it("flipY mirrors y around 0.5", () => {
    const result = rotateVertex([0.3, 0.7, 0.2], tf(0, false, false, true));
    assert.ok(approxEqual(result[0], 0.3));
    assert.ok(approxEqual(result[1], 0.3));
    assert.ok(approxEqual(result[2], 0.2));
  });

  it("block center [0.5,0.5,0.5] is invariant under flipY", () => {
    const result = rotateVertex([0.5, 0.5, 0.5], tf(0, false, false, true));
    assert.ok(vecApproxEqual(result, [0.5, 0.5, 0.5]));
  });

  it("flipY composes with rotation: rot=1 then flipY", () => {
    // rot=1: [0,0,0] → [0,0,1]; then flipY: y stays 0 → 1-0=1
    const result = rotateVertex([0, 0, 0], tf(1, false, false, true));
    assert.ok(vecApproxEqual(result, [0, 1, 1]));
  });
});

describe("rotateNormal", () => {
  it("rotation 0 with no flips is identity", () => {
    assert.deepEqual(rotateNormal([1, 0, 0], tf(0)), [1, 0, 0]);
  });

  it("rot=1: [1,0,0] → [0,0,-1]", () => {
    const result = rotateNormal([1, 0, 0], tf(1));
    assert.ok(vecApproxEqual(result, [0, 0, -1]));
  });

  it("rot=1: [0,0,1] → [1,0,0]", () => {
    const result = rotateNormal([0, 0, 1], tf(1));
    assert.ok(vecApproxEqual(result, [1, 0, 0]));
  });

  it("rot=2: [1,0,0] → [-1,0,0]", () => {
    const result = rotateNormal([1, 0, 0], tf(2));
    assert.ok(vecApproxEqual(result, [-1, 0, 0]));
  });

  it("flipX negates nx component", () => {
    const result = rotateNormal([0.5, 0, 0.5], tf(0, true, false));
    assert.ok(vecApproxEqual(result, [-0.5, 0, 0.5]));
  });

  it("flipZ negates nz component", () => {
    const result = rotateNormal([0, 0, 1], tf(0, false, true));
    assert.ok(vecApproxEqual(result, [0, 0, -1]));
  });

  it("Y component is unchanged when flipY is not set", () => {
    const result = rotateNormal([0, 0.7, 0], tf(2, true, true));
    assert.ok(approxEqual(result[1], 0.7));
  });
});

describe("rotateNormal with flipY", () => {
  it("flipY negates ny component", () => {
    const result = rotateNormal([0, 0.7, 0], tf(0, false, false, true));
    assert.ok(approxEqual(result[0], 0));
    assert.ok(approxEqual(result[1], -0.7));
    assert.ok(approxEqual(result[2], 0));
  });

  it("X and Z components are unchanged by flipY alone", () => {
    const result = rotateNormal([0.5, 0.3, 0.4], tf(0, false, false, true));
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
