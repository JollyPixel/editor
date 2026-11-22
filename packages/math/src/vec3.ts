// Import Internal Dependencies
import type {
  Mat4,
  Quat,
  Vec3,
  Vector3Like
} from "./types.ts";

export function create(
  x = 0,
  y = 0,
  z = 0
): Vec3 {
  return [x, y, z];
}

export function copy(
  out: Vec3,
  a: Readonly<Vec3>
): Vec3 {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];

  return out;
}

export function load(
  out: Vec3,
  value: Readonly<Vector3Like>
): Vec3 {
  out[0] = value.x;
  out[1] = value.y;
  out[2] = value.z;

  return out;
}

export function write<T extends Vector3Like>(
  out: T,
  a: Readonly<Vec3>
): T {
  out.x = a[0];
  out.y = a[1];
  out.z = a[2];

  return out;
}

export function add(
  out: Vec3,
  a: Readonly<Vec3>,
  b: Readonly<Vec3>
): Vec3 {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];

  return out;
}

export function subtract(
  out: Vec3,
  a: Readonly<Vec3>,
  b: Readonly<Vec3>
): Vec3 {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];

  return out;
}

export function scale(
  out: Vec3,
  a: Readonly<Vec3>,
  factor: number
): Vec3 {
  out[0] = a[0] * factor;
  out[1] = a[1] * factor;
  out[2] = a[2] * factor;

  return out;
}

export function cross(
  out: Vec3,
  a: Readonly<Vec3>,
  b: Readonly<Vec3>
): Vec3 {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const bx = b[0];
  const by = b[1];
  const bz = b[2];
  out[0] = (ay * bz) - (az * by);
  out[1] = (az * bx) - (ax * bz);
  out[2] = (ax * by) - (ay * bx);

  return out;
}

export function squaredLength(
  a: Readonly<Vec3>
): number {
  const x = a[0];
  const y = a[1];
  const z = a[2];

  return (x * x) + (y * y) + (z * z);
}

export function distance(
  a: Readonly<Vec3>,
  b: Readonly<Vec3>
): number {
  const x = b[0] - a[0];
  const y = b[1] - a[1];
  const z = b[2] - a[2];

  return Math.sqrt((x * x) + (y * y) + (z * z));
}

export function normalize(
  out: Vec3,
  a: Readonly<Vec3>
): Vec3 {
  const x = a[0];
  const y = a[1];
  const z = a[2];
  const squared = (x * x) + (y * y) + (z * z);
  const inverse = squared > 0 ? 1 / Math.sqrt(squared) : 0;
  out[0] = x * inverse;
  out[1] = y * inverse;
  out[2] = z * inverse;

  return out;
}

export function lerp(
  out: Vec3,
  a: Readonly<Vec3>,
  b: Readonly<Vec3>,
  alpha: number
): Vec3 {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  out[0] = ax + (alpha * (b[0] - ax));
  out[1] = ay + (alpha * (b[1] - ay));
  out[2] = az + (alpha * (b[2] - az));

  return out;
}

export function transformQuat(
  out: Vec3,
  a: Readonly<Vec3>,
  q: Readonly<Quat>
): Vec3 {
  const vx = a[0];
  const vy = a[1];
  const vz = a[2];
  const qx = q[0];
  const qy = q[1];
  const qz = q[2];
  const qw = q[3];
  const tx = 2 * ((qy * vz) - (qz * vy));
  const ty = 2 * ((qz * vx) - (qx * vz));
  const tz = 2 * ((qx * vy) - (qy * vx));
  out[0] = vx + (qw * tx) + (qy * tz) - (qz * ty);
  out[1] = vy + (qw * ty) + (qz * tx) - (qx * tz);
  out[2] = vz + (qw * tz) + (qx * ty) - (qy * tx);

  return out;
}

export function transformMat4(
  out: Vec3,
  a: Readonly<Vec3>,
  m: Readonly<Mat4>
): Vec3 {
  const x = a[0];
  const y = a[1];
  const z = a[2];
  const w = (m[3] * x) + (m[7] * y) + (m[11] * z) + m[15];
  const inverse = w === 0 ? 1 : 1 / w;
  out[0] = ((m[0] * x) + (m[4] * y) + (m[8] * z) + m[12]) * inverse;
  out[1] = ((m[1] * x) + (m[5] * y) + (m[9] * z) + m[13]) * inverse;
  out[2] = ((m[2] * x) + (m[6] * y) + (m[10] * z) + m[14]) * inverse;

  return out;
}
