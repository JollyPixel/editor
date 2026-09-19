// Import Third-party Dependencies
import * as THREE from "three";
import type { Vector3JSON } from "@jolly-pixel/asset.voxel-model/network/client.ts";

export function toVector3JSON(
  value: Vector3JSON
): Vector3JSON {
  return {
    x: value.x,
    y: value.y,
    z: value.z
  };
}

export function toVector3(
  value: Vector3JSON
): THREE.Vector3 {
  return new THREE.Vector3(value.x, value.y, value.z);
}

export function toEuler(
  value: Vector3JSON
): THREE.Euler {
  return new THREE.Euler(value.x, value.y, value.z);
}
