export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function subtract(
  left: Point3,
  right: Point3
): Point3 {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

export function cross(
  left: Point3,
  right: Point3
): Point3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x
  };
}

export function dot(
  left: Point3,
  right: Point3
): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}
