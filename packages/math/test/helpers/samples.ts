// Import Third-party Dependencies
import {
  Matrix4,
  Quaternion,
  Vector3
} from "three";

// Import Internal Dependencies
import * as mat4 from "#src/mat4.ts";
import type {
  Mat4,
  Quat,
  Vec3
} from "#src/types.ts";

// CONSTANTS
export const SAMPLE_COUNT = 64;

export function seededRandom(
  seed = 0x9e3779b9
): () => number {
  let state = seed >>> 0;

  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function randomVec3(
  random: () => number,
  range = 10
): Vec3 {
  return [
    ((random() * 2) - 1) * range,
    ((random() * 2) - 1) * range,
    ((random() * 2) - 1) * range
  ];
}

export function randomQuat(
  random: () => number
): Quat {
  const quaternion = new Quaternion(
    (random() * 2) - 1,
    (random() * 2) - 1,
    (random() * 2) - 1,
    (random() * 2) - 1
  ).normalize();

  return quaternion.toArray();
}

export function randomMat4(
  random: () => number
): Mat4 {
  const matrix = mat4.create();
  for (let index = 0; index < 16; index++) {
    matrix[index] = ((random() * 2) - 1) * 4;
  }

  return matrix;
}

export function threeVector(
  value: Readonly<Vec3>
): Vector3 {
  return new Vector3(value[0], value[1], value[2]);
}

export function threeQuaternion(
  value: Readonly<Quat>
): Quaternion {
  return new Quaternion(value[0], value[1], value[2], value[3]);
}

export function threeMatrix(
  value: Readonly<Mat4>
): Matrix4 {
  return new Matrix4().fromArray(value);
}
