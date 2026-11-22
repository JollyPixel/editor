// Import Third-party Dependencies
import {
  euler,
  mat3,
  mat4,
  quat,
  vec3,
  type Mat4,
  type Quat,
  type Vec3
} from "math";

export {
  clamp,
  euler,
  mat4,
  quat,
  vec3,
  DEGREES_TO_RADIANS,
  RADIANS_TO_DEGREES,
  type Euler,
  type Mat4,
  type Quat,
  type Vec3
} from "math";

// CONSTANTS
const kRotation = mat3.create();
const kLookMatrix = mat4.create();
const kLookX = vec3.create();
const kLookY = vec3.create();
const kLookZ = vec3.create();
const kEuler = euler.create();
const kParallelNudge = 0.0001;

export interface Vector2Like {
  x: number;
  y: number;
}

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface Vector4Like {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface QuaternionLike {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface EulerLike {
  x: number;
  y: number;
  z: number;
}

export function loadVector3(
  out: Vec3,
  value: Readonly<Vector3Like>
): Vec3 {
  return vec3.set(out, value.x, value.y, value.z);
}

export function loadQuaternion(
  out: Quat,
  value: Readonly<QuaternionLike>
): Quat {
  return quat.set(out, value.x, value.y, value.z, value.w);
}

export function loadEuler(
  out: Quat,
  value: Readonly<EulerLike>
): Quat {
  return quat.fromEuler(out, euler.set(kEuler, value.x, value.y, value.z, "xyz"));
}

export function loadMatrix(
  out: Mat4,
  value: Readonly<ArrayLike<number>>
): Mat4 {
  for (let index = 0; index < 16; index++) {
    out[index] = value[index];
  }

  return out;
}

export function writeVector3(
  out: Vector3Like,
  value: Readonly<Vec3>
): Vector3Like {
  out.x = value[0];
  out.y = value[1];
  out.z = value[2];

  return out;
}

export function writeQuaternion(
  out: QuaternionLike,
  value: Readonly<Quat>
): QuaternionLike {
  out.x = value[0];
  out.y = value[1];
  out.z = value[2];
  out.w = value[3];

  return out;
}

export function writeEuler(
  out: EulerLike,
  value: Quat
): EulerLike {
  const [x, y, z] = euler.fromQuat(kEuler, value, "xyz");
  out.x = x;
  out.y = y;
  out.z = z;

  return out;
}

export function invertMatrix(
  out: Mat4,
  matrix: Mat4
): Mat4 {
  return mat4.invert(out, matrix) ?? mat4.zero(out);
}

export function decomposeMatrix(
  matrix: Mat4,
  position: Vec3,
  quaternion: Quat,
  scale: Vec3
): void {
  mat4.getTranslation(position, matrix);
  mat4.getScaling(scale, matrix);
  if (mat4.determinant(matrix) < 0) {
    scale[0] = -scale[0];
  }
  mat3.set(
    kRotation,
    matrix[0] / scale[0],
    matrix[1] / scale[0],
    matrix[2] / scale[0],
    matrix[4] / scale[1],
    matrix[5] / scale[1],
    matrix[6] / scale[1],
    matrix[8] / scale[2],
    matrix[9] / scale[2],
    matrix[10] / scale[2]
  );
  quat.fromMat3(quaternion, kRotation);
}

export function lookRotation(
  out: Quat,
  eye: Vec3,
  target: Vec3,
  up: Vec3
): Quat {
  vec3.subtract(kLookZ, eye, target);
  if (vec3.squaredLength(kLookZ) === 0) {
    kLookZ[2] = 1;
  }
  vec3.normalize(kLookZ, kLookZ);
  vec3.cross(kLookX, up, kLookZ);
  if (vec3.squaredLength(kLookX) === 0) {
    if (Math.abs(up[2]) === 1) {
      kLookZ[0] += kParallelNudge;
    }
    else {
      kLookZ[2] += kParallelNudge;
    }
    vec3.normalize(kLookZ, kLookZ);
    vec3.cross(kLookX, up, kLookZ);
  }
  vec3.normalize(kLookX, kLookX);
  vec3.cross(kLookY, kLookZ, kLookX);

  for (let axis = 0; axis < 3; axis++) {
    kLookMatrix[axis] = kLookX[axis];
    kLookMatrix[axis + 4] = kLookY[axis];
    kLookMatrix[axis + 8] = kLookZ[axis];
  }

  return quat.fromMat4(out, kLookMatrix);
}
