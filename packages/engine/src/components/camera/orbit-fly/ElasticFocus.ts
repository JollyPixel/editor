// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { PivotMarker } from "./pivotMarker.ts";
import {
  type CameraFocus,
  type CameraFocusPose,
  dampScalar,
  smoothingFactor
} from "./CameraFocus.ts";

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
  showPivotMarker: boolean;
  /**
   * Resolves the scene root lazily, on first use.
   */
  sceneProvider: () => THREE.Object3D;
}

/**
 * WASD/look pilot a free-floating pivot; the camera trails behind it at a
 * scroll-adjusted distance, reaching 0 (free-fly) at full zoom-in.
 */
export class ElasticFocus implements CameraFocus {
  readonly isLocked = false;

  #maxTrailDistance: number;
  #marker: PivotMarker;

  #pivotPosition: THREE.Vector3;
  #trailDistance: number;
  #targetTrailDistance: number;

  #forward = new THREE.Vector3();
  #cameraPosition = new THREE.Vector3();

  constructor(
    options: ElasticFocusOptions
  ) {
    this.#maxTrailDistance = options.maxTrailDistance;
    this.#marker = new PivotMarker({
      enabled: options.showPivotMarker,
      sceneProvider: options.sceneProvider
    });
    this.#pivotPosition = new THREE.Vector3().copy(options.initialPosition);
    this.#trailDistance = options.initialTrailDistance ?? 0;
    this.#targetTrailDistance = this.#trailDistance;

    if (this.#targetTrailDistance > 0) {
      this.#marker.show();
    }
  }

  get isOrbiting(): boolean {
    return this.#trailDistance > 0;
  }

  get trailDistance(): number {
    return this.#trailDistance;
  }

  get pivot(): THREE.Vector3Like {
    return this.#pivotPosition;
  }

  enter(): null {
    return null;
  }

  exit(): void {
    return;
  }

  nudge(): void {
    return;
  }

  move(
    offset: THREE.Vector3
  ): void {
    this.#pivotPosition.add(offset);
  }

  handleScroll(
    scrollY: number,
    scrollSpeed: number
  ): boolean {
    this.#targetTrailDistance = THREE.MathUtils.clamp(
      this.#targetTrailDistance - (scrollY * scrollSpeed),
      0,
      this.#maxTrailDistance
    );

    if (this.#targetTrailDistance > 0) {
      this.#marker.show();
    }
    else {
      this.#marker.hide();
    }

    return true;
  }

  updatePose(
    pose: CameraFocusPose
  ): void {
    const { transform, orientation, deltaTime, responsiveness } = pose;

    this.#trailDistance = dampScalar(
      this.#trailDistance,
      this.#targetTrailDistance,
      smoothingFactor(responsiveness, deltaTime)
    );

    this.#forward.set(0, 0, -1).applyQuaternion(orientation);
    this.#cameraPosition
      .copy(this.#pivotPosition)
      .addScaledVector(this.#forward, -this.#trailDistance);

    transform.setLocalPosition(this.#cameraPosition);
    this.#marker.moveTo(this.#pivotPosition);
  }

  dispose(): void {
    this.#marker.dispose();
  }
}
