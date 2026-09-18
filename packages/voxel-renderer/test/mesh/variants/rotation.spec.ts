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
import {
  FACE,
  FACES,
  FACE_NORMALS
} from "../../../src/utils/math.ts";
import { VoxelTransform } from "../../../src/world/index.ts";
import { approxEqual } from "../../helpers/math.ts";

type Vec3 = [number, number, number];

function tf(
  rotation: number,
  flipX = false,
  flipZ = false,
  flipY = false
): VoxelTransform {
  return new VoxelTransform({ rotation, flipX, flipZ, flipY });
}

function assertVecApprox(
  actual: readonly number[],
  expected: readonly number[],
  message?: string
): void {
  assert.ok(
    actual.length === expected.length &&
    actual.every((value, i) => approxEqual(value, expected[i])),
    message ?? `${actual} != ${expected}`
  );
}

describe("rotateFace", () => {
  const kCases: [FACE, number, FACE][] = [
    [FACE.PosX, 1, FACE.NegZ],
    [FACE.NegX, 1, FACE.PosZ],
    [FACE.PosZ, 1, FACE.PosX],
    [FACE.NegZ, 1, FACE.NegX],
    [FACE.PosY, 1, FACE.PosY],
    [FACE.NegY, 1, FACE.NegY],
    [FACE.PosX, 2, FACE.NegX],
    [FACE.PosZ, 2, FACE.NegZ]
  ];

  for (const [face, rotation, expected] of kCases) {
    it(`rot=${rotation} turns face ${face} into ${expected}`, () => {
      assert.equal(rotateFace(face, rotation), expected);
    });
  }

  it("is the identity at rotation 0 and wraps rotation 4 back to it", () => {
    for (const face of FACES) {
      assert.equal(rotateFace(face, 0), face);
      assert.equal(rotateFace(face, 4), face);
    }
  });

  it("agrees with rotateNormal on every face normal", () => {
    for (let rotation = 0; rotation < 4; rotation++) {
      for (const face of FACES) {
        assertVecApprox(
          rotateNormal([...FACE_NORMALS[face]], tf(rotation)),
          FACE_NORMALS[rotateFace(face, rotation)],
          `face ${face} rotation ${rotation}`
        );
      }
    }
  });
});

describe("rotateVertex", () => {
  const kCases: [string, Vec3, VoxelTransform, Vec3][] = [
    ["is the identity without rotation or flip", [0.3, 0.7, 0.2], tf(0), [0.3, 0.7, 0.2]],
    ["rot=1 turns [1,0,0] into [0,0,0]", [1, 0, 0], tf(1), [0, 0, 0]],
    ["rot=1 turns [0,0,0] into [0,0,1]", [0, 0, 0], tf(1), [0, 0, 1]],
    ["rot=1 turns [0,0,1] into [1,0,1]", [0, 0, 1], tf(1), [1, 0, 1]],
    ["rot=1 turns [1,0,1] into [1,0,0]", [1, 0, 1], tf(1), [1, 0, 0]],
    ["rot=2 sends [1,0,0] to the opposite corner", [1, 0, 0], tf(2), [0, 0, 1]],
    ["rot=2 sends [0,0,0] to the opposite corner", [0, 0, 0], tf(2), [1, 0, 1]],
    ["flipX mirrors x around 0.5", [1, 0, 0], tf(0, true), [0, 0, 0]],
    ["flipZ mirrors z around 0.5", [0, 0, 0.2], tf(0, false, true), [0, 0, 0.8]],
    ["flipY mirrors y around 0.5", [0.3, 0.7, 0.2], tf(0, false, false, true), [0.3, 0.3, 0.2]],
    ["flipY composes with rotation", [0, 0, 0], tf(1, false, false, true), [0, 1, 1]]
  ];

  for (const [name, vertex, transform, expected] of kCases) {
    it(name, () => {
      assertVecApprox(rotateVertex([...vertex], transform), expected);
    });
  }

  it("keeps the block center fixed under every transform", () => {
    for (let packed = 0; packed < 32; packed++) {
      assertVecApprox(
        rotateVertex([0.5, 0.5, 0.5], VoxelTransform.fromPacked(packed)),
        [0.5, 0.5, 0.5],
        `transform ${packed}`
      );
    }
  });

  it("leaves y untouched without flipY", () => {
    assert.ok(approxEqual(rotateVertex([0.3, 0.7, 0.2], tf(3, true, true))[1], 0.7));
  });
});

describe("rotateNormal", () => {
  const kCases: [string, Vec3, VoxelTransform, Vec3][] = [
    ["is the identity without rotation or flip", [1, 0, 0], tf(0), [1, 0, 0]],
    ["rot=1 turns +X into -Z", [1, 0, 0], tf(1), [0, 0, -1]],
    ["rot=1 turns +Z into +X", [0, 0, 1], tf(1), [1, 0, 0]],
    ["rot=2 turns +X into -X", [1, 0, 0], tf(2), [-1, 0, 0]],
    ["flipX negates x", [0.5, 0, 0.5], tf(0, true), [-0.5, 0, 0.5]],
    ["flipZ negates z", [0, 0, 1], tf(0, false, true), [0, 0, -1]],
    ["flipY negates y only", [0.5, 0.7, 0.4], tf(0, false, false, true), [0.5, -0.7, 0.4]]
  ];

  for (const [name, normal, transform, expected] of kCases) {
    it(name, () => {
      assertVecApprox(rotateNormal([...normal], transform), expected);
    });
  }

  it("leaves y untouched without flipY", () => {
    assert.ok(approxEqual(rotateNormal([0, 0.7, 0], tf(2, true, true))[1], 0.7));
  });
});

describe("flipYFace", () => {
  it("swaps the Y faces and passes every other face through", () => {
    assert.deepEqual(
      FACES.map(flipYFace),
      FACES.map((face) => {
        if (face === FACE.PosY) {
          return FACE.NegY;
        }

        return face === FACE.NegY ? FACE.PosY : face;
      })
    );
  });
});
