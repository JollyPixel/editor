// Import Third-party Dependencies
import * as THREE from "three";
import type {
  GroupTransformJSON,
  Vector3JSON
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

export function toVector3JSON(
  value: THREE.Vector3Like
): Vector3JSON {
  return {
    x: value.x,
    y: value.y,
    z: value.z
  };
}

export function toVector3(
  value: THREE.Vector3Like
): THREE.Vector3 {
  return new THREE.Vector3(
    value.x,
    value.y,
    value.z
  );
}

export function toEuler(
  value: THREE.Vector3Like
): THREE.Euler {
  return new THREE.Euler(
    value.x,
    value.y,
    value.z
  );
}

export function parseGroupTransformJSON(
  value: unknown
): GroupTransformJSON | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const position = parseVector3JSON(Reflect.get(value, "position"));
  const pivotOffset = parseVector3JSON(Reflect.get(value, "pivotOffset"));
  const size = parseVector3JSON(Reflect.get(value, "size"));
  const scale = parseVector3JSON(Reflect.get(value, "scale"));
  const rotation = parseVector3JSON(Reflect.get(value, "rotation"));
  if (
    position === undefined ||
    pivotOffset === undefined ||
    size === undefined ||
    scale === undefined ||
    rotation === undefined
  ) {
    return undefined;
  }

  return {
    position,
    pivotOffset,
    size,
    scale,
    rotation
  };
}

function parseVector3JSON(
  value: unknown
): Vector3JSON | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const x: unknown = Reflect.get(value, "x");
  const y: unknown = Reflect.get(value, "y");
  const z: unknown = Reflect.get(value, "z");
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number"
  ) {
    return undefined;
  }

  return { x, y, z };
}
