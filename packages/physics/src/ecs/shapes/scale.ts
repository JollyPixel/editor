// Import Third-party Dependencies
import type { Vector3Like } from "@jolly-pixel/math";

// Import Internal Dependencies
import type { ColliderShape } from "../../ColliderShape.ts";
import type { ColliderSettings } from "../RigidBody.ts";

export function scaleCollider(
  collider: Readonly<ColliderSettings>,
  scale: Vector3Like
): ColliderSettings {
  const {
    shape, offset, ...material
  } = collider;

  return {
    ...material,
    shape: scaleShape(shape, scale),
    offset: {
      x: offset.x * scale.x,
      y: offset.y * scale.y,
      z: offset.z * scale.z
    }
  };
}

function scaleShape(
  shape: ColliderShape,
  scale: Vector3Like
): ColliderShape {
  const x = Math.abs(scale.x);
  const y = Math.abs(scale.y);
  const z = Math.abs(scale.z);
  const factors = [x, y, z];

  switch (shape.type) {
    case "box":
      return {
        type: "box",
        halfExtents: {
          x: shape.halfExtents.x * x,
          y: shape.halfExtents.y * y,
          z: shape.halfExtents.z * z
        }
      };
    case "sphere":
      return {
        type: "sphere",
        radius: shape.radius * Math.max(x, y, z)
      };
    case "capsule":
      return {
        type: "capsule",
        halfHeight: shape.halfHeight * y,
        radius: shape.radius * Math.max(x, z)
      };
    case "trimesh":
      return {
        type: "trimesh",
        vertices: shape.vertices.map(
          (value, index) => value * factors[index % 3]
        ),
        indices: shape.indices
      };
    default:
      return shape satisfies never;
  }
}
