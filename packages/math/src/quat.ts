// Import Internal Dependencies
import { rotationToQuat } from "./rotation.ts";
import { clamp } from "./scalar.ts";
import type {
  EulerLike,
  Mat4,
  Quat,
  QuaternionLike,
  Vec3
} from "./types.ts";

// CONSTANTS
const kGimbalLimit = 0.9999999;
const kParallelNudge = 0.0001;
const kSlerpThreshold = 1e-6;
const kBasis: Mat4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
];

export function create(): Quat {
  return [0, 0, 0, 1];
}

export function copy(
  out: Quat,
  a: Readonly<Quat>
): Quat {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];

  return out;
}

export function load(
  out: Quat,
  value: Readonly<QuaternionLike>
): Quat {
  out[0] = value.x;
  out[1] = value.y;
  out[2] = value.z;
  out[3] = value.w;

  return out;
}

export function write<T extends QuaternionLike>(
  out: T,
  a: Readonly<Quat>
): T {
  out.x = a[0];
  out.y = a[1];
  out.z = a[2];
  out.w = a[3];

  return out;
}

export function loadEuler(
  out: Quat,
  euler: Readonly<EulerLike>
): Quat {
  const halfX = euler.x * 0.5;
  const halfY = euler.y * 0.5;
  const halfZ = euler.z * 0.5;
  const c1 = Math.cos(halfX);
  const c2 = Math.cos(halfY);
  const c3 = Math.cos(halfZ);
  const s1 = Math.sin(halfX);
  const s2 = Math.sin(halfY);
  const s3 = Math.sin(halfZ);
  out[0] = (s1 * c2 * c3) + (c1 * s2 * s3);
  out[1] = (c1 * s2 * c3) - (s1 * c2 * s3);
  out[2] = (c1 * c2 * s3) + (s1 * s2 * c3);
  out[3] = (c1 * c2 * c3) - (s1 * s2 * s3);

  return out;
}

export function writeEuler<T extends EulerLike>(
  out: T,
  q: Readonly<Quat>
): T {
  const x = q[0];
  const y = q[1];
  const z = q[2];
  const w = q[3];
  const m13 = 2 * ((x * z) + (w * y));
  out.y = Math.asin(clamp(m13, -1, 1));
  if (Math.abs(m13) < kGimbalLimit) {
    out.x = Math.atan2(
      -2 * ((y * z) - (w * x)),
      1 - (2 * ((x * x) + (y * y)))
    );
    out.z = Math.atan2(
      -2 * ((x * y) - (w * z)),
      1 - (2 * ((y * y) + (z * z)))
    );
  }
  else {
    out.x = Math.atan2(
      2 * ((y * z) + (w * x)),
      1 - (2 * ((x * x) + (z * z)))
    );
    out.z = 0;
  }

  return out;
}

export function multiply(
  out: Quat,
  a: Readonly<Quat>,
  b: Readonly<Quat>
): Quat {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const aw = a[3];
  const bx = b[0];
  const by = b[1];
  const bz = b[2];
  const bw = b[3];
  out[0] = (ax * bw) + (aw * bx) + (ay * bz) - (az * by);
  out[1] = (ay * bw) + (aw * by) + (az * bx) - (ax * bz);
  out[2] = (az * bw) + (aw * bz) + (ax * by) - (ay * bx);
  out[3] = (aw * bw) - (ax * bx) - (ay * by) - (az * bz);

  return out;
}

export function invert(
  out: Quat,
  a: Readonly<Quat>
): Quat {
  const x = a[0];
  const y = a[1];
  const z = a[2];
  const w = a[3];
  const squared = (x * x) + (y * y) + (z * z) + (w * w);
  const inverse = squared === 0 ? 0 : 1 / squared;
  out[0] = -x * inverse;
  out[1] = -y * inverse;
  out[2] = -z * inverse;
  out[3] = w * inverse;

  return out;
}

export function slerp(
  out: Quat,
  a: Readonly<Quat>,
  b: Readonly<Quat>,
  alpha: number
): Quat {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const aw = a[3];
  let bx = b[0];
  let by = b[1];
  let bz = b[2];
  let bw = b[3];
  let cos = (ax * bx) + (ay * by) + (az * bz) + (aw * bw);
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  if (1 - cos > kSlerpThreshold) {
    const angle = Math.acos(cos);
    const inverseSin = 1 / Math.sin(angle);
    const from = Math.sin((1 - alpha) * angle) * inverseSin;
    const to = Math.sin(alpha * angle) * inverseSin;
    out[0] = (ax * from) + (bx * to);
    out[1] = (ay * from) + (by * to);
    out[2] = (az * from) + (bz * to);
    out[3] = (aw * from) + (bw * to);

    return out;
  }

  const from = 1 - alpha;
  const x = (ax * from) + (bx * alpha);
  const y = (ay * from) + (by * alpha);
  const z = (az * from) + (bz * alpha);
  const w = (aw * from) + (bw * alpha);
  const inverse = 1 / Math.sqrt((x * x) + (y * y) + (z * z) + (w * w));
  out[0] = x * inverse;
  out[1] = y * inverse;
  out[2] = z * inverse;
  out[3] = w * inverse;

  return out;
}

export function lookAt(
  out: Quat,
  eye: Readonly<Vec3>,
  target: Readonly<Vec3>,
  up: Readonly<Vec3>
): Quat {
  const ux = up[0];
  const uy = up[1];
  const uz = up[2];
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let squared = (zx * zx) + (zy * zy) + (zz * zz);
  if (squared === 0) {
    zz = 1;
    squared = 1;
  }
  let inverse = 1 / Math.sqrt(squared);
  zx *= inverse;
  zy *= inverse;
  zz *= inverse;

  let xx = (uy * zz) - (uz * zy);
  let xy = (uz * zx) - (ux * zz);
  let xz = (ux * zy) - (uy * zx);
  squared = (xx * xx) + (xy * xy) + (xz * xz);
  if (squared === 0) {
    if (Math.abs(uz) === 1) {
      zx += kParallelNudge;
    }
    else {
      zz += kParallelNudge;
    }
    inverse = 1 / Math.sqrt((zx * zx) + (zy * zy) + (zz * zz));
    zx *= inverse;
    zy *= inverse;
    zz *= inverse;
    xx = (uy * zz) - (uz * zy);
    xy = (uz * zx) - (ux * zz);
    xz = (ux * zy) - (uy * zx);
    squared = (xx * xx) + (xy * xy) + (xz * xz);
  }
  inverse = 1 / Math.sqrt(squared);
  xx *= inverse;
  xy *= inverse;
  xz *= inverse;

  const yx = (zy * xz) - (zz * xy);
  const yy = (zz * xx) - (zx * xz);
  const yz = (zx * xy) - (zy * xx);

  kBasis[0] = xx;
  kBasis[1] = xy;
  kBasis[2] = xz;
  kBasis[4] = yx;
  kBasis[5] = yy;
  kBasis[6] = yz;
  kBasis[8] = zx;
  kBasis[9] = zy;
  kBasis[10] = zz;

  return rotationToQuat(out, kBasis, 1, 1, 1);
}
