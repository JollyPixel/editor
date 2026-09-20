// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Axis,
  AXIS_DIRECTION
} from "../../common/axes.ts";
import type { TransformHandle } from "../types.ts";

// CONSTANTS
const kProjectionEpsilon = 1e-6;
const kEdgeOnEpsilon = 0.05;

const kNormal = new THREE.Vector3();

export interface GestureContext {
  handle: TransformHandle;
  ray: THREE.Ray;
  origin: THREE.Vector3;
  quaternion: THREE.Quaternion;
  eye: THREE.Vector3;
  cameraQuaternion: THREE.Quaternion;
  size: number;
}

export function frameAxis(
  context: GestureContext,
  axis: Axis,
  target: THREE.Vector3
): THREE.Vector3 {
  return target
    .copy(AXIS_DIRECTION[axis])
    .applyQuaternion(context.quaternion)
    .normalize();
}

export function viewDirection(
  context: GestureContext,
  target: THREE.Vector3
): THREE.Vector3 {
  return target
    .set(0, 0, 1)
    .applyQuaternion(context.cameraQuaternion)
    .normalize();
}

export function axisDragPlane(
  context: GestureContext,
  axisDirection: THREE.Vector3,
  target: THREE.Plane
): boolean {
  kNormal
    .copy(context.eye)
    .addScaledVector(axisDirection, -context.eye.dot(axisDirection));
  if (kNormal.lengthSq() < kProjectionEpsilon) {
    return false;
  }

  target.setFromNormalAndCoplanarPoint(
    kNormal.normalize(),
    context.origin
  );

  return true;
}

export function facingDragPlane(
  context: GestureContext,
  normal: THREE.Vector3,
  target: THREE.Plane
): boolean {
  if (Math.abs(context.eye.dot(normal)) < kEdgeOnEpsilon) {
    return false;
  }

  target.setFromNormalAndCoplanarPoint(normal, context.origin);

  return true;
}
