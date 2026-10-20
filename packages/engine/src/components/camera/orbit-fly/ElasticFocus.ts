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
   * Trail distance changed per wheel notch, in world units.
   */
  trailScrollStep: number;
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

export class ElasticFocus implements CameraFocus {
  readonly isLocked = false;

  #maxTrailDistance: number;
  #trailScrollStep: number;
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
    this.#trailScrollStep = options.trailScrollStep;
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

  get settled(): boolean {
    return this.#trailDistance === this.#targetTrailDistance;
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

  teleported(
    position: THREE.Vector3Like,
    orientation: THREE.Quaternion
  ): void {
    this.#trailDistance = this.#targetTrailDistance;
    this.#forward.set(0, 0, -1).applyQuaternion(orientation);
    this.#pivotPosition
      .copy(position)
      .addScaledVector(this.#forward, this.#trailDistance);
    this.#marker.moveTo(this.#pivotPosition);
  }

  handleScroll(
    scrollY: number
  ): boolean {
    this.#targetTrailDistance = THREE.MathUtils.clamp(
      this.#targetTrailDistance - (scrollY * this.#trailScrollStep),
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
