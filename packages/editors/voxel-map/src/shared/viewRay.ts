// Import Third-party Dependencies
import * as THREE from "three";
import {
  voxelCellOf,
  voxelPositionOf
} from "@jolly-pixel/voxel.renderer";
import type { Vector3Like } from "three";

// CONSTANTS
const kScreenCenter = new THREE.Vector2(0, 0);
const kGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const kDefaultGroundPlaneSize = 4096;
const kDefaultFallbackDistance = 12;
const kDefaultMinDistance = 2;
const kDefaultMaxDistance = 64;

export interface ViewRayHit {
  point: THREE.Vector3;
  distance: number;
  normal: THREE.Vector3;
  ground: boolean;
}

export interface ViewRayOptions {
  pointer?: THREE.Vector2;
  groundPlaneSize?: number;
  raycaster?: THREE.Raycaster;
}

export interface ViewFocusOptions extends ViewRayOptions {
  fallbackDistance?: number;
  minDistance?: number;
  maxDistance?: number;
}

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function viewportPointer(
  rect: ViewportRect,
  clientX: number,
  clientY: number
): THREE.Vector2 | null {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (
    !(x >= 0 && x <= 1) ||
    !(y >= 0 && y <= 1)
  ) {
    return null;
  }

  return new THREE.Vector2(
    (x * 2) - 1,
    1 - (y * 2)
  );
}

export function castViewRay(
  camera: THREE.Camera,
  solid: THREE.Object3D | null,
  options: ViewRayOptions = {}
): ViewRayHit | null {
  const {
    pointer = kScreenCenter,
    groundPlaneSize = kDefaultGroundPlaneSize,
    raycaster = new THREE.Raycaster()
  } = options;

  raycaster.setFromCamera(
    pointer,
    camera
  );

  if (solid !== null) {
    const [hit] = raycaster.intersectObject(solid, true);
    if (hit !== undefined) {
      return {
        point: hit.point.clone(),
        distance: hit.distance,
        normal: hit.face?.normal.clone() ?? kGroundPlane.normal.clone(),
        ground: false
      };
    }
  }

  const point = raycaster.ray.intersectPlane(
    kGroundPlane,
    new THREE.Vector3()
  );
  const halfSize = groundPlaneSize / 2;
  if (
    point === null ||
    Math.abs(point.x) > halfSize ||
    Math.abs(point.z) > halfSize
  ) {
    return null;
  }

  return {
    point,
    distance: point.distanceTo(
      raycaster.ray.origin
    ),
    normal: kGroundPlane.normal.clone(),
    ground: true
  };
}

export function viewFocusPoint(
  camera: THREE.Camera,
  solid: THREE.Object3D | null,
  options: ViewFocusOptions = {}
): Vector3Like {
  const {
    fallbackDistance = kDefaultFallbackDistance,
    minDistance = kDefaultMinDistance,
    maxDistance = kDefaultMaxDistance,
    raycaster = new THREE.Raycaster(),
    ...rayOptions
  } = options;

  const hit = castViewRay(camera, solid, {
    ...rayOptions,
    raycaster
  });

  if (
    hit !== null &&
    hit.distance >= minDistance &&
    hit.distance <= maxDistance
  ) {
    return voxelPositionOf(hit.point, hit.normal, "front");
  }

  const distance = hit === null ?
    fallbackDistance :
    Math.min(maxDistance, Math.max(minDistance, hit.distance));

  return voxelCellOf(
    raycaster.ray.at(distance, new THREE.Vector3())
  );
}
