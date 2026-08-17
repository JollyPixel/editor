// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  eulerRoundTrips,
  eulerToQuaternion,
  quaternionToEuler
} from "../../src/math/euler.ts";
import type { QuatLike } from "../../src/math/types.ts";

// CONSTANTS
const kDeg = Math.PI / 180;

function quatClose(
  a: QuatLike,
  b: QuatLike,
  epsilon = 1e-9
): boolean {
  const dot = (a.x * b.x) + (a.y * b.y) + (a.z * b.z) + (a.w * b.w);

  return Math.abs(Math.abs(dot) - 1) < epsilon;
}

describe("Math.euler", () => {
  test("identity converts both ways", () => {
    const euler = quaternionToEuler({
      x: 0,
      y: 0,
      z: 0,
      w: 1
    });

    assert.equal(euler.x + 0, 0);
    assert.equal(euler.y + 0, 0);
    assert.equal(euler.z + 0, 0);
    assert.ok(quatClose(
      eulerToQuaternion(euler),
      { x: 0, y: 0, z: 0, w: 1 }
    ));
  });

  test("round trips a single-axis rotation", () => {
    const euler = { x: 30 * kDeg, y: 0, z: 0 };
    const back = quaternionToEuler(
      eulerToQuaternion(euler)
    );

    assert.ok(Math.abs(back.x - euler.x) < 1e-9);
    assert.ok(Math.abs(back.y - euler.y) < 1e-9);
    assert.ok(Math.abs(back.z - euler.z) < 1e-9);
  });

  test("round trips a compound rotation", () => {
    const euler = { x: 20 * kDeg, y: 40 * kDeg, z: -15 * kDeg };
    const quaternion = eulerToQuaternion(euler);
    const back = eulerToQuaternion(
      quaternionToEuler(quaternion)
    );

    assert.ok(quatClose(quaternion, back));
  });

  test("survives a pitch approaching the gimbal pole without a NaN", () => {
    // 89.99 degrees keeps m13 just under the gimbal clamp.
    const euler = { x: 10 * kDeg, y: 89.99 * kDeg, z: 5 * kDeg };
    const back = quaternionToEuler(
      eulerToQuaternion(euler)
    );

    assert.ok(Number.isFinite(back.x));
    assert.ok(Number.isFinite(back.y));
    assert.ok(Number.isFinite(back.z));
  });

  test("collapses Z at the gimbal pole itself", () => {
    const euler = quaternionToEuler(
      eulerToQuaternion({ x: 0, y: 90 * kDeg, z: 40 * kDeg })
    );

    assert.equal(euler.z, 0);
    assert.ok(Math.abs(euler.y - (90 * kDeg)) < 1e-6);
  });

  test("eulerRoundTrips accepts a draft that still converts to the target", () => {
    const draft = { x: 12 * kDeg, y: 8 * kDeg, z: 3 * kDeg };
    const target = eulerToQuaternion(draft);

    assert.ok(eulerRoundTrips(draft, target));
  });

  test("eulerRoundTrips ignores quaternion double cover, q and -q are the same rotation", () => {
    const draft = { x: 12 * kDeg, y: 8 * kDeg, z: 3 * kDeg };
    const target = eulerToQuaternion(draft);
    const negated: QuatLike = {
      x: -target.x,
      y: -target.y,
      z: -target.z,
      w: -target.w
    };

    assert.ok(eulerRoundTrips(draft, negated));
  });

  test("eulerRoundTrips rejects a draft the incoming value no longer matches", () => {
    const draft = { x: 12 * kDeg, y: 8 * kDeg, z: 3 * kDeg };
    const unrelated = eulerToQuaternion({ x: 60 * kDeg, y: -20 * kDeg, z: 0 });

    assert.equal(eulerRoundTrips(draft, unrelated), false);
  });
});
