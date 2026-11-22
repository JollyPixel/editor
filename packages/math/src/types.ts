export type Vec3 = [x: number, y: number, z: number];

export type Quat = [x: number, y: number, z: number, w: number];

export type Mat4 = [
  m11: number, m21: number, m31: number, m41: number,
  m12: number, m22: number, m32: number, m42: number,
  m13: number, m23: number, m33: number, m43: number,
  m14: number, m24: number, m34: number, m44: number
];

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
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
