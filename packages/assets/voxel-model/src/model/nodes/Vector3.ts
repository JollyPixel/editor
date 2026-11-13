// Import Internal Dependencies
import type { Vector3JSON } from "../types.ts";

export interface Axes3<T> {
  x: T;
  y: T;
  z: T;
}

export class Vector3 {
  static combine(
    left: Vector3JSON,
    right: Vector3JSON,
    merge: (left: number, right: number) => number
  ): Vector3JSON {
    return {
      x: merge(left.x, right.x),
      y: merge(left.y, right.y),
      z: merge(left.z, right.z)
    };
  }

  static same<T>(
    left: Readonly<Axes3<T>>,
    right: Readonly<Axes3<T>>
  ): boolean {
    return left.x === right.x && left.y === right.y && left.z === right.z;
  }
}
