// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type GroupManager from "./GroupManager.ts";
import type { GroupTransformSnapshot } from "./hooks.ts";

export function vec3Like(
  value: { x: number; y: number; z: number; }
): { x: number; y: number; z: number; } {
  return { x: value.x, y: value.y, z: value.z };
}

export function toVector3(
  value: { x: number; y: number; z: number; }
): THREE.Vector3 {
  return new THREE.Vector3(value.x, value.y, value.z);
}

export function toEuler(
  value: { x: number; y: number; z: number; }
): THREE.Euler {
  return new THREE.Euler(value.x, value.y, value.z);
}

export function snapshotTransform(
  group: GroupManager
): GroupTransformSnapshot {
  return {
    position: vec3Like(group.getPosition()),
    pivotOffset: vec3Like(group.getPivotOffset()),
    size: vec3Like(group.getSize()),
    scale: vec3Like(group.getScale()),
    rotation: vec3Like(group.getRotation())
  };
}
