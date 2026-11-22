// Import Internal Dependencies
import type {
  Mat4,
  Quat
} from "./types.ts";

export function rotationToQuat(
  out: Quat,
  m: Readonly<Mat4>,
  inverseScaleX: number,
  inverseScaleY: number,
  inverseScaleZ: number
): Quat {
  const m11 = m[0] * inverseScaleX;
  const m21 = m[1] * inverseScaleX;
  const m31 = m[2] * inverseScaleX;
  const m12 = m[4] * inverseScaleY;
  const m22 = m[5] * inverseScaleY;
  const m32 = m[6] * inverseScaleY;
  const m13 = m[8] * inverseScaleZ;
  const m23 = m[9] * inverseScaleZ;
  const m33 = m[10] * inverseScaleZ;
  const trace = m11 + m22 + m33;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    out[0] = (m32 - m23) * s;
    out[1] = (m13 - m31) * s;
    out[2] = (m21 - m12) * s;
    out[3] = 0.25 / s;
  }
  else if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
    const inverse = 1 / s;
    out[0] = 0.25 * s;
    out[1] = (m12 + m21) * inverse;
    out[2] = (m13 + m31) * inverse;
    out[3] = (m32 - m23) * inverse;
  }
  else if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
    const inverse = 1 / s;
    out[0] = (m12 + m21) * inverse;
    out[1] = 0.25 * s;
    out[2] = (m23 + m32) * inverse;
    out[3] = (m13 - m31) * inverse;
  }
  else {
    const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
    const inverse = 1 / s;
    out[0] = (m13 + m31) * inverse;
    out[1] = (m23 + m32) * inverse;
    out[2] = 0.25 * s;
    out[3] = (m21 - m12) * inverse;
  }

  return out;
}
