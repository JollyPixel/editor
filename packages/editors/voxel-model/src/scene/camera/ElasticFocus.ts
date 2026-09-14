// Import Third-party Dependencies
import * as THREE from "three";
import {
  type Actor,
  disposeObject3D
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { createPivotMarker } from "./pivotMarker.ts";

// CONSTANTS
const kSmoothingSnapEpsilon = 1e-3;

export interface ElasticFocusOptions {
  initialPosition: THREE.Vector3Like;
  /**
   * How far the camera can trail behind the pivot, in world units.
   */
  maxTrailDistance: number;
  /**
   * Starting trail distance, in world units.
   * @default 0
   */
  initialTrailDistance?: number;
  /**
   * Resolves the scene root lazily, on first use.
   */
  sceneProvider: () => THREE.Object3D;
}

/**
 * WASD/look pilot a free-floating pivot; the camera trails behind it at a
 * scroll-adjusted distance, reaching 0 (free-fly) at full zoom-in. Ported
 * from voxel-map's `src/scene/camera/ElasticFocus.ts`, with an added
 * `initialTrailDistance` option (voxel-map's original always starts at 0).
 */
export class ElasticFocus {
  #maxTrailDistance: number;
  #sceneProvider: () => THREE.Object3D;

  #pivotPosition: THREE.Vector3;
  #trailDistance: number;
  #targetTrailDistance: number;
  #pivotMarker: THREE.Object3D | null = null;

  #forward = new THREE.Vector3();
  #cameraPosition = new THREE.Vector3();

  constructor(
    options: ElasticFocusOptions
  ) {
    this.#maxTrailDistance = options.maxTrailDistance;
    this.#sceneProvider = options.sceneProvider;
    this.#pivotPosition = new THREE.Vector3().copy(options.initialPosition);
    this.#trailDistance = options.initialTrailDistance ?? 0;
    this.#targetTrailDistance = this.#trailDistance;
  }

  get trailDistance(): number {
    return this.#trailDistance;
  }

  get pivotPosition(): THREE.Vector3Like {
    return this.#pivotPosition;
  }

  move(
    offset: THREE.Vector3
  ): void {
    this.#pivotPosition.add(offset);
  }

  adjustTrailDistance(
    delta: number
  ): void {
    this.#targetTrailDistance = Math.min(
      this.#maxTrailDistance,
      Math.max(0, this.#targetTrailDistance + delta)
    );

    if (this.#targetTrailDistance > 0) {
      this.#ensureMarker().visible = true;
    }
    else {
      this.#hideMarker();
    }
  }

  updatePose(
    transform: Actor["transform"],
    orientation: THREE.Quaternion,
    deltaTime: number,
    responsiveness: number
  ): void {
    this.#trailDistance += (this.#targetTrailDistance - this.#trailDistance) *
      (1 - Math.exp(-responsiveness * deltaTime));
    if (Math.abs(this.#targetTrailDistance - this.#trailDistance) < kSmoothingSnapEpsilon) {
      this.#trailDistance = this.#targetTrailDistance;
    }

    this.#forward.set(0, 0, -1).applyQuaternion(orientation);
    this.#cameraPosition
      .copy(this.#pivotPosition)
      .addScaledVector(this.#forward, -this.#trailDistance);

    transform.setLocalPosition(this.#cameraPosition);

    if (this.#pivotMarker) {
      this.#pivotMarker.position.copy(this.#pivotPosition);
    }
  }

  #ensureMarker(): THREE.Object3D {
    if (this.#pivotMarker === null) {
      this.#pivotMarker = createPivotMarker();
      this.#sceneProvider().add(this.#pivotMarker);
    }

    return this.#pivotMarker;
  }

  #hideMarker(): void {
    if (this.#pivotMarker) {
      this.#pivotMarker.visible = false;
    }
  }

  dispose(): void {
    if (this.#pivotMarker) {
      disposeObject3D(this.#pivotMarker);
      this.#pivotMarker = null;
    }
  }
}
