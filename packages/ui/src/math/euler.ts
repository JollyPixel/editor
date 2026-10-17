// Import Internal Dependencies
import { clamp } from "../numeric/bounds.ts";
import type { QuatLike } from "./types.ts";

// CONSTANTS
const kGimbalEpsilon = 0.9999999;
const kRoundTripEpsilon = 1e-5;

export interface EulerAngles {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function quaternionToEuler(
  quaternion: QuatLike
): EulerAngles {
  const { x: qx, y: qy, z: qz, w: qw } = quaternion;

  const m11 = 1 - (2 * ((qy * qy) + (qz * qz)));
  const m12 = 2 * ((qx * qy) - (qz * qw));
  const m13 = 2 * ((qx * qz) + (qy * qw));
  const m22 = 1 - (2 * ((qx * qx) + (qz * qz)));
  const m23 = 2 * ((qy * qz) - (qx * qw));
  const m32 = 2 * ((qy * qz) + (qx * qw));
  const m33 = 1 - (2 * ((qx * qx) + (qy * qy)));

  const y = Math.asin(
    clamp(m13, -1, 1)
  );

  if (Math.abs(m13) < kGimbalEpsilon) {
    return {
      x: Math.atan2(-m23, m33),
      y,
      z: Math.atan2(-m12, m11)
    };
  }

  return {
    x: Math.atan2(m32, m22),
    y,
    z: 0
  };
}

export function eulerToQuaternion(
  euler: EulerAngles
): QuatLike {
  const { x, y, z } = euler;

  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);

  return {
    x: (s1 * c2 * c3) + (c1 * s2 * s3),
    y: (c1 * s2 * c3) - (s1 * c2 * s3),
    z: (c1 * c2 * s3) + (s1 * s2 * c3),
    w: (c1 * c2 * c3) - (s1 * s2 * s3)
  };
}

export function eulerRoundTrips(
  euler: EulerAngles,
  target: QuatLike,
  epsilon: number = kRoundTripEpsilon
): boolean {
  const q = eulerToQuaternion(euler);
  const dot = (q.x * target.x) +
    (q.y * target.y) +
    (q.z * target.z) +
    (q.w * target.w);

  return Math.abs(Math.abs(dot) - 1) < epsilon;
}

