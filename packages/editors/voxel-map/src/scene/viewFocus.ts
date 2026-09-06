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
const kOrigin: Vector3Like = {
  x: 0,
  y: 0,
  z: 0
};

export interface ViewRayHit {
  /**
   * World-space hit point.
   */
  point: THREE.Vector3;
  /**
   * Camera distance, in world units.
   */
  distance: number;
  /**
   * Surface normal in the hit object's local space.
   */
  normal: THREE.Vector3;
  /**
   * True when the ground plane was hit.
   */
  ground: boolean;
}

export interface ViewRayOptions {
  /**
   * Pointer in normalized device coordinates.
   * @default the screen center
   */
  pointer?: THREE.Vector2;
  /**
   * Fallback ground-plane side length, in world units.
   * @default 4096
   */
  groundPlaneSize?: number;
  /**
   * Raycaster to reuse across calls.
   */
  raycaster?: THREE.Raycaster;
}

export interface ViewFocusOptions extends ViewRayOptions {
  /**
   * Distance used when no surface is hit, in world units.
   * @default 12
   */
  fallbackDistance?: number;
  /**
   * Nearest resolved focus distance, in world units.
   * @default 2
   */
  minDistance?: number;
  /**
   * Farthest resolved focus distance, in world units.
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

export type ViewFocusProvider = () => Vector3Like;

export class ViewFocus {
  #provider: ViewFocusProvider | null = null;

  get provider(): ViewFocusProvider | null {
    return this.#provider;
  }

  set provider(provider: ViewFocusProvider | null) {
    this.#provider = provider;
  }

  get point(): Vector3Like {
    return this.#provider?.() ?? kOrigin;
  }
}
