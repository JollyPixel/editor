// Import Third-party Dependencies
import * as THREE from "three";
import {
  voxelCellOf,
  voxelPositionOf
} from "@jolly-pixel/voxel.renderer";
import type { Vector3Like } from "@jolly-pixel/three";

// CONSTANTS
const kScreenCenter = new THREE.Vector2(0, 0);
const kGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const kDefaultGroundPlaneSize = 4096;
const kDefaultFallbackDistance = 12;
const kDefaultMinDistance = 2;
const kDefaultMaxDistance = 64;

export interface ViewRayHit {
  /**
   * World-space point where the ray landed.
   */
  point: THREE.Vector3;
  /**
   * Distance from the camera, in world units.
   */
  distance: number;
  /**
   * Normal of the surface that was hit, in the space of the object owning it.
   */
  normal: THREE.Vector3;
  /**
   * True when the ray missed every solid and landed on the ground plane.
   */
  ground: boolean;
}

export interface ViewRayOptions {
  /**
   * Normalized device coordinates to cast through.
   * @default the screen center
   */
  pointer?: THREE.Vector2;
  /**
   * Side of the square ground plane, centered on the origin, used when the
   * ray misses every solid. Past its bounds the ray hits nothing.
   * @default 4096
   */
  groundPlaneSize?: number;
  /**
   * Raycaster to reuse instead of allocating one.
   */
  raycaster?: THREE.Raycaster;
}

export interface ViewFocusOptions extends ViewRayOptions {
  /**
   * Distance ahead of the camera used when the ray hits nothing, in world
   * units.
   * @default 12
   */
  fallbackDistance?: number;
  /**
   * Bounds, in world units, the resolved point is kept within so a grazing
   * ray never lands over the horizon.
   * @default 2
   */
  minDistance?: number;
  /**
   * @default 64
   */
  maxDistance?: number;
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

  raycaster.setFromCamera(pointer, camera);

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
    distance: point.distanceTo(raycaster.ray.origin),
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
