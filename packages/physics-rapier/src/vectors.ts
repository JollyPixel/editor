// Import Third-party Dependencies
import type {
  QuaternionLike,
  Vector3Like
} from "@jolly-pixel/physics";

export function copyVector(
  vector: Vector3Like
): Vector3Like {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z
  };
}

export function copyQuaternion(
  quaternion: QuaternionLike
): QuaternionLike {
  return {
    x: quaternion.x,
    y: quaternion.y,
    z: quaternion.z,
    w: quaternion.w
  };
}
