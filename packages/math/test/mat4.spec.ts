// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Matrix4,
  Quaternion,
  Vector3
} from "three";

// Import Internal Dependencies
import {
  mat4,
  quat,
  vec3,
  type Mat4
} from "#src/index.ts";
import {
  assertClose,
  assertSameRotation
} from "./helpers/assertClose.ts";
import {
  SAMPLE_COUNT,
  randomMat4,
  randomQuat,
  randomVec3,
  seededRandom,
  threeMatrix,
  threeQuaternion,
  threeVector
} from "./helpers/samples.ts";

describe("mat4", () => {
  test("should multiply like three.js, even when out aliases an operand", () => {
    const random = seededRandom();
    for (let sample = 0; sample < SAMPLE_COUNT; sample++) {
      const a = randomMat4(random);
      const b = randomMat4(random);
      const expected = new Matrix4()
        .multiplyMatrices(threeMatrix(a), threeMatrix(b))
        .toArray();

      assertClose(mat4.multiply(mat4.create(), a, b), expected);
      assertClose(mat4.multiply(mat4.copy(mat4.create(), a), a, b), expected);
      assertClose(mat4.multiply(b, a, b), expected);
    }
  });

  test("should invert like three.js", () => {
    const random = seededRandom();
    for (let sample = 0; sample < SAMPLE_COUNT; sample++) {
      const matrix = randomMat4(random);
      const expected = threeMatrix(matrix).invert().toArray();

      assertClose(mat4.invert(matrix, matrix), expected, 1e-7);
    }
  });

  test("should invert a singular matrix to zeros", () => {
    const singular: Mat4 = [
      1, 2, 3, 0,
      2, 4, 6, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];

    assert.ok(
      mat4.invert(mat4.create(), singular).every((value) => value === 0)
    );
  });

  test("should compose like three.js", () => {
    const random = seededRandom();
    for (let sample = 0; sample < SAMPLE_COUNT; sample++) {
      const position = randomVec3(random);
      const quaternion = randomQuat(random);
      const scale = randomVec3(random, 3);
      const expected = new Matrix4().compose(
        threeVector(position),
        threeQuaternion(quaternion),
        threeVector(scale)
      ).toArray();

      assertClose(
        mat4.compose(mat4.create(), position, quaternion, scale),
        expected
      );
    }
  });

  test("should decompose non-uniform and mirrored scales like three.js", () => {
    const random = seededRandom();
    for (let sample = 0; sample < SAMPLE_COUNT; sample++) {
      const scale = randomVec3(random, 3);
      if (sample % 2 === 0) {
        scale[1] = -scale[1];
      }
      const matrix = mat4.compose(
        mat4.create(),
        randomVec3(random),
        randomQuat(random),
        scale
      );
      const expectedPosition = new Vector3();
      const expectedQuaternion = new Quaternion();
      const expectedScale = new Vector3();
      threeMatrix(matrix).decompose(
        expectedPosition,
        expectedQuaternion,
        expectedScale
      );
      const position = vec3.create();
      const quaternion = quat.create();
      const decomposedScale = vec3.create();

      mat4.decompose(matrix, position, quaternion, decomposedScale);

      assertClose(position, expectedPosition.toArray());
      assertClose(decomposedScale, expectedScale.toArray());
      assertSameRotation(quaternion, expectedQuaternion.toArray(), 1e-7);
      assertClose(
        mat4.compose(mat4.create(), position, quaternion, decomposedScale),
        matrix,
        1e-7
      );
    }
  });
});
