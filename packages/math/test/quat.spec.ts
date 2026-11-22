// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Euler,
  Matrix4,
  Quaternion
} from "three";

// Import Internal Dependencies
import {
  quat,
  type EulerLike,
  type Quat,
  type Vec3
} from "#src/index.ts";
import {
  assertClose,
  assertSameRotation
} from "./helpers/assertClose.ts";
import {
  SAMPLE_COUNT,
  randomQuat,
  randomVec3,
  seededRandom,
  threeQuaternion,
  threeVector
} from "./helpers/samples.ts";

function expectedLookAt(
  eye: Readonly<Vec3>,
  target: Readonly<Vec3>,
  up: Readonly<Vec3>
): Quat {
  const rotation = new Matrix4().lookAt(
    threeVector(eye),
    threeVector(target),
    threeVector(up)
  );

  return new Quaternion().setFromRotationMatrix(rotation).toArray();
}

describe("quat", () => {
  test("should multiply like three.js, even when out aliases an operand", () => {
    const random = seededRandom();
    for (let sample = 0; sample < SAMPLE_COUNT; sample++) {
      const a = randomQuat(random);
      const b = randomQuat(random);
      const expected = new Quaternion()
        .multiplyQuaternions(threeQuaternion(a), threeQuaternion(b))
        .toArray();

      assertClose(quat.multiply(b, a, b), expected);
    }
  });

  test("should invert a rotation and leave a zero quaternion at zero", () => {
    const random = seededRandom();
    const rotation = randomQuat(random);

    assertClose(
      quat.multiply(quat.create(), rotation, quat.invert(quat.create(), rotation)),
      [0, 0, 0, 1]
    );
    assert.ok(
      quat.invert(quat.create(), [0, 0, 0, 0]).every((value) => value === 0)
    );
  });

  test("should slerp like three.js across the whole range", () => {
    const random = seededRandom();
    for (let sample = 0; sample < SAMPLE_COUNT; sample++) {
      const a = randomQuat(random);
      const b = randomQuat(random);
      const alpha = random();
      const expected = threeQuaternion(a)
        .slerp(threeQuaternion(b), alpha)
        .toArray();

      assertClose(quat.slerp(a, a, b, alpha), expected, 1e-7);
    }
  });

  test("should slerp along the shortest arc", () => {
    const half = Math.SQRT1_2;
    const from: Quat = [0, 0, 0, 1];
    const to: Quat = [0, -half, 0, -half];

    assertClose(
      quat.slerp(quat.create(), from, to, 0.5),
      [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)]
    );
  });

  test("should return a unit quaternion between nearly equal rotations", () => {
    const from: Quat = [0, 0, 0, 1];
    const to = quat.loadEuler(quat.create(), {
      x: 1e-9,
      y: 0,
      z: 0
    });

    assertSameRotation(quat.slerp(quat.create(), from, to, 0.5), from);
  });

  test("should convert XYZ Euler angles both ways like three.js", () => {
    const random = seededRandom();
    for (let sample = 0; sample < SAMPLE_COUNT; sample++) {
      const angles = randomVec3(random, Math.PI);
      const expected = new Quaternion()
        .setFromEuler(new Euler(angles[0], angles[1], angles[2], "XYZ"))
        .toArray();
      const quaternion = quat.loadEuler(quat.create(), {
        x: angles[0],
        y: angles[1],
        z: angles[2]
      });
      const euler = new Euler().setFromQuaternion(
        threeQuaternion(quaternion),
        "XYZ"
      );

      assertClose(quaternion, expected);
      const written = quat.writeEuler({ x: 0, y: 0, z: 0 }, quaternion);
      assertClose(
        [written.x, written.y, written.z],
        [euler.x, euler.y, euler.z],
        1e-7
      );
    }
  });

  test("should put a gimbal-locked rotation on x and zero z", () => {
    const quaternion = quat.loadEuler(quat.create(), {
      x: 0.4,
      y: Math.PI / 2,
      z: 0.3
    });
    const euler: EulerLike = quat.writeEuler({ x: 0, y: 0, z: 0 }, quaternion);

    assert.ok(Math.abs(euler.y - (Math.PI / 2)) < 1e-6);
    assert.strictEqual(euler.z, 0);
    assertSameRotation(
      quat.loadEuler(quat.create(), euler),
      quaternion,
      1e-6
    );
  });

  test("should look at a target like three.js Matrix4.lookAt", () => {
    const random = seededRandom();
    for (let sample = 0; sample < SAMPLE_COUNT; sample++) {
      const eye = randomVec3(random);
      const target = randomVec3(random);
      const up = randomVec3(random);

      assertSameRotation(
        quat.lookAt(quat.create(), eye, target, up),
        expectedLookAt(eye, target, up)
      );
    }
  });

  for (const [title, eye, target, up] of [
    ["the eye sits on the target", [1, 2, 3], [1, 2, 3], [0, 1, 0]],
    ["the view is parallel to up", [0, 0, 0], [0, 5, 0], [0, 1, 0]],
    ["the view is parallel to a z up", [0, 0, 0], [0, 0, 5], [0, 0, 1]]
  ] satisfies [string, Vec3, Vec3, Vec3][]) {
    test(`should fall back like three.js when ${title}`, () => {
      assertSameRotation(
        quat.lookAt(quat.create(), eye, target, up),
        expectedLookAt(eye, target, up)
      );
    });
  }
});
