// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  vec3,
  type Mat4
} from "#src/index.ts";
import { assertClose } from "./helpers/assertClose.ts";
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

describe("vec3", () => {
  test("should rotate by a quaternion like three.js", () => {
    const random = seededRandom();
    for (let sample = 0; sample < SAMPLE_COUNT; sample++) {
      const vector = randomVec3(random);
      const quaternion = randomQuat(random);
      const expected = threeVector(vector)
        .applyQuaternion(threeQuaternion(quaternion))
        .toArray();

      assertClose(vec3.transformQuat(vector, vector, quaternion), expected);
    }
  });

  test("should transform by a projective matrix like three.js", () => {
    const random = seededRandom();
    for (let sample = 0; sample < SAMPLE_COUNT; sample++) {
      const vector = randomVec3(random);
      const matrix = randomMat4(random);
      const expected = threeVector(vector)
        .applyMatrix4(threeMatrix(matrix))
        .toArray();

      assertClose(vec3.transformMat4(vector, vector, matrix), expected, 1e-7);
    }
  });

  test("should skip the perspective divide when w is zero", () => {
    const matrix: Mat4 = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      2, 3, 4, 0
    ];

    assert.deepEqual(
      vec3.transformMat4(vec3.create(), [1, 1, 1], matrix),
      [3, 4, 5]
    );
  });

  test("should leave a zero vector at zero when normalized", () => {
    assert.deepEqual(vec3.normalize(vec3.create(), [0, 0, 0]), [0, 0, 0]);
  });

  test("should cross like three.js, even when out aliases an operand", () => {
    const random = seededRandom();
    const a = randomVec3(random);
    const b = randomVec3(random);
    const expected = threeVector(a).cross(threeVector(b)).toArray();

    assertClose(vec3.cross(a, a, b), expected);
  });
});
