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
  camera: THREE.Camera;
  groundPlaneSize?: number;
}

export interface ViewFocusOptions {
  pointer?: THREE.Vector2;
  fallbackDistance?: number;
  minDistance?: number;
  maxDistance?: number;
}

export class ViewRay {
  #camera: THREE.Camera;
  #groundPlaneSize: number;
  #raycaster = new THREE.Raycaster();

  constructor(
    options: ViewRayOptions
  ) {
    this.#camera = options.camera;
    this.#groundPlaneSize = options.groundPlaneSize ?? kDefaultGroundPlaneSize;
  }

  get ray(): THREE.Ray {
    return this.#raycaster.ray;
  }

  aim(
    pointer: THREE.Vector2 = kScreenCenter
  ): THREE.Ray {
    this.#raycaster.setFromCamera(
      pointer,
      this.#camera
    );

    return this.#raycaster.ray;
  }

  cast(
    solid: THREE.Object3D | null,
    pointer?: THREE.Vector2
  ): ViewRayHit | null {
    const ray = this.aim(pointer);

    if (solid !== null) {
      const [hit] = this.#raycaster.intersectObject(solid, true);
      if (hit !== undefined) {
        return {
          point: hit.point.clone(),
          distance: hit.distance,
          normal: hit.face?.normal.clone() ?? kGroundPlane.normal.clone(),
          ground: false
        };
      }
    }

    const point = ray.intersectPlane(
      kGroundPlane,
      new THREE.Vector3()
    );
    const halfSize = this.#groundPlaneSize / 2;
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
        ray.origin
      ),
      normal: kGroundPlane.normal.clone(),
      ground: true
    };
  }

  focusPoint(
    solid: THREE.Object3D | null,
    options: ViewFocusOptions = {}
  ): Vector3Like {
    const {
      pointer,
      fallbackDistance = kDefaultFallbackDistance,
      minDistance = kDefaultMinDistance,
      maxDistance = kDefaultMaxDistance
    } = options;

    const hit = this.cast(solid, pointer);

    if (
      hit !== null &&
      hit.distance >= minDistance &&
      hit.distance <= maxDistance
    ) {
      return voxelPositionOf(
        hit.point,
        hit.normal,
        "front"
      );
    }

    const distance = hit === null ?
      fallbackDistance :
      Math.min(maxDistance, Math.max(minDistance, hit.distance));

    return voxelCellOf(
      this.ray.at(distance, new THREE.Vector3())
    );
  }
}
