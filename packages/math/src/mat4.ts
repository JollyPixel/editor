// Import Internal Dependencies
import { rotationToQuat } from "./rotation.ts";
import type {
  Mat4,
  Quat,
  Vec3
} from "./types.ts";

export function create(): Mat4 {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

export function identity(
  out: Mat4
): Mat4 {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;

  return out;
}

export function copy(
  out: Mat4,
  value: Readonly<ArrayLike<number>>
): Mat4 {
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  out[3] = value[3];
  out[4] = value[4];
  out[5] = value[5];
  out[6] = value[6];
  out[7] = value[7];
  out[8] = value[8];
  out[9] = value[9];
  out[10] = value[10];
  out[11] = value[11];
  out[12] = value[12];
  out[13] = value[13];
  out[14] = value[14];
  out[15] = value[15];

  return out;
}

export function multiply(
  out: Mat4,
  a: Readonly<Mat4>,
  b: Readonly<Mat4>
): Mat4 {
  const a11 = a[0];
  const a21 = a[1];
  const a31 = a[2];
  const a41 = a[3];
  const a12 = a[4];
  const a22 = a[5];
  const a32 = a[6];
  const a42 = a[7];
  const a13 = a[8];
  const a23 = a[9];
  const a33 = a[10];
  const a43 = a[11];
  const a14 = a[12];
  const a24 = a[13];
  const a34 = a[14];
  const a44 = a[15];

  let b1 = b[0];
  let b2 = b[1];
  let b3 = b[2];
  let b4 = b[3];
  out[0] = (a11 * b1) + (a12 * b2) + (a13 * b3) + (a14 * b4);
  out[1] = (a21 * b1) + (a22 * b2) + (a23 * b3) + (a24 * b4);
  out[2] = (a31 * b1) + (a32 * b2) + (a33 * b3) + (a34 * b4);
  out[3] = (a41 * b1) + (a42 * b2) + (a43 * b3) + (a44 * b4);

  b1 = b[4];
  b2 = b[5];
  b3 = b[6];
  b4 = b[7];
  out[4] = (a11 * b1) + (a12 * b2) + (a13 * b3) + (a14 * b4);
  out[5] = (a21 * b1) + (a22 * b2) + (a23 * b3) + (a24 * b4);
  out[6] = (a31 * b1) + (a32 * b2) + (a33 * b3) + (a34 * b4);
  out[7] = (a41 * b1) + (a42 * b2) + (a43 * b3) + (a44 * b4);

  b1 = b[8];
  b2 = b[9];
  b3 = b[10];
  b4 = b[11];
  out[8] = (a11 * b1) + (a12 * b2) + (a13 * b3) + (a14 * b4);
  out[9] = (a21 * b1) + (a22 * b2) + (a23 * b3) + (a24 * b4);
  out[10] = (a31 * b1) + (a32 * b2) + (a33 * b3) + (a34 * b4);
  out[11] = (a41 * b1) + (a42 * b2) + (a43 * b3) + (a44 * b4);

  b1 = b[12];
  b2 = b[13];
  b3 = b[14];
  b4 = b[15];
  out[12] = (a11 * b1) + (a12 * b2) + (a13 * b3) + (a14 * b4);
  out[13] = (a21 * b1) + (a22 * b2) + (a23 * b3) + (a24 * b4);
  out[14] = (a31 * b1) + (a32 * b2) + (a33 * b3) + (a34 * b4);
  out[15] = (a41 * b1) + (a42 * b2) + (a43 * b3) + (a44 * b4);

  return out;
}

export function invert(
  out: Mat4,
  a: Readonly<Mat4>
): Mat4 {
  const m11 = a[0];
  const m21 = a[1];
  const m31 = a[2];
  const m41 = a[3];
  const m12 = a[4];
  const m22 = a[5];
  const m32 = a[6];
  const m42 = a[7];
  const m13 = a[8];
  const m23 = a[9];
  const m33 = a[10];
  const m43 = a[11];
  const m14 = a[12];
  const m24 = a[13];
  const m34 = a[14];
  const m44 = a[15];
  const b00 = (m11 * m22) - (m21 * m12);
  const b01 = (m11 * m32) - (m31 * m12);
  const b02 = (m11 * m42) - (m41 * m12);
  const b03 = (m21 * m32) - (m31 * m22);
  const b04 = (m21 * m42) - (m41 * m22);
  const b05 = (m31 * m42) - (m41 * m32);
  const b06 = (m13 * m24) - (m23 * m14);
  const b07 = (m13 * m34) - (m33 * m14);
  const b08 = (m13 * m44) - (m43 * m14);
  const b09 = (m23 * m34) - (m33 * m24);
  const b10 = (m23 * m44) - (m43 * m24);
  const b11 = (m33 * m44) - (m43 * m34);
  const det = (b00 * b11) - (b01 * b10) + (b02 * b09) +
    (b03 * b08) - (b04 * b07) + (b05 * b06);
  if (det === 0) {
    out.fill(0);

    return out;
  }
  const inverse = 1 / det;
  out[0] = ((m22 * b11) - (m32 * b10) + (m42 * b09)) * inverse;
  out[1] = ((m31 * b10) - (m21 * b11) - (m41 * b09)) * inverse;
  out[2] = ((m24 * b05) - (m34 * b04) + (m44 * b03)) * inverse;
  out[3] = ((m33 * b04) - (m23 * b05) - (m43 * b03)) * inverse;
  out[4] = ((m32 * b08) - (m12 * b11) - (m42 * b07)) * inverse;
  out[5] = ((m11 * b11) - (m31 * b08) + (m41 * b07)) * inverse;
  out[6] = ((m34 * b02) - (m14 * b05) - (m44 * b01)) * inverse;
  out[7] = ((m13 * b05) - (m33 * b02) + (m43 * b01)) * inverse;
  out[8] = ((m12 * b10) - (m22 * b08) + (m42 * b06)) * inverse;
  out[9] = ((m21 * b08) - (m11 * b10) - (m41 * b06)) * inverse;
  out[10] = ((m14 * b04) - (m24 * b02) + (m44 * b00)) * inverse;
  out[11] = ((m23 * b02) - (m13 * b04) - (m43 * b00)) * inverse;
  out[12] = ((m22 * b07) - (m12 * b09) - (m32 * b06)) * inverse;
  out[13] = ((m11 * b09) - (m21 * b07) + (m31 * b06)) * inverse;
  out[14] = ((m24 * b01) - (m14 * b03) - (m34 * b00)) * inverse;
  out[15] = ((m13 * b03) - (m23 * b01) + (m33 * b00)) * inverse;

  return out;
}

export function compose(
  out: Mat4,
  position: Readonly<Vec3>,
  quaternion: Readonly<Quat>,
  scale: Readonly<Vec3>
): Mat4 {
  const x = quaternion[0];
  const y = quaternion[1];
  const z = quaternion[2];
  const w = quaternion[3];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const sx = scale[0];
  const sy = scale[1];
  const sz = scale[2];
  out[0] = (1 - (yy + zz)) * sx;
  out[1] = (xy + wz) * sx;
  out[2] = (xz - wy) * sx;
  out[3] = 0;
  out[4] = (xy - wz) * sy;
  out[5] = (1 - (xx + zz)) * sy;
  out[6] = (yz + wx) * sy;
  out[7] = 0;
  out[8] = (xz + wy) * sz;
  out[9] = (yz - wx) * sz;
  out[10] = (1 - (xx + yy)) * sz;
  out[11] = 0;
  out[12] = position[0];
  out[13] = position[1];
  out[14] = position[2];
  out[15] = 1;

  return out;
}

export function decompose(
  m: Readonly<Mat4>,
  position: Vec3,
  quaternion: Quat,
  scale: Vec3
): void {
  const m11 = m[0];
  const m21 = m[1];
  const m31 = m[2];
  const m12 = m[4];
  const m22 = m[5];
  const m32 = m[6];
  const m13 = m[8];
  const m23 = m[9];
  const m33 = m[10];
  const determinant3 = (m11 * ((m22 * m33) - (m32 * m23))) -
    (m12 * ((m21 * m33) - (m31 * m23))) +
    (m13 * ((m21 * m32) - (m31 * m22)));
  let sx = Math.sqrt((m11 * m11) + (m21 * m21) + (m31 * m31));
  const sy = Math.sqrt((m12 * m12) + (m22 * m22) + (m32 * m32));
  const sz = Math.sqrt((m13 * m13) + (m23 * m23) + (m33 * m33));
  if (determinant3 < 0) {
    sx = -sx;
  }

  position[0] = m[12];
  position[1] = m[13];
  position[2] = m[14];
  scale[0] = sx;
  scale[1] = sy;
  scale[2] = sz;

  rotationToQuat(quaternion, m, 1 / sx, 1 / sy, 1 / sz);
}

export function extractTranslation(
  out: Vec3,
  m: Readonly<Mat4>
): Vec3 {
  out[0] = m[12];
  out[1] = m[13];
  out[2] = m[14];

  return out;
}
