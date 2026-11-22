// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { PivotMarker } from "./pivotMarker.ts";
import { NumberRange } from "./NumberRange.ts";
import type { WorldScale } from "./WorldScale.ts";
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
  pivotMarkerSize: number;
  scale: WorldScale;
  /**
   * Resolves the scene root lazily, on first use.
   */
  sceneProvider: () => THREE.Object3D;
}

export class ElasticFocus implements CameraFocus {
  readonly isLocked = false;

  #trailRange: NumberRange;
  #trailScrollStep: number;
  #scale: WorldScale;
  #marker: PivotMarker;

  #pivotPosition: THREE.Vector3;
  #trailDistance: number;
  #targetTrailDistance: number;

  #forward = new THREE.Vector3();

  constructor(
    options: ElasticFocusOptions
  ) {
    this.#trailRange = new NumberRange(0, options.maxTrailDistance);
    this.#trailScrollStep = options.trailScrollStep;
    this.#scale = options.scale;
    this.#marker = new PivotMarker({
      enabled: options.showPivotMarker,
      size: options.pivotMarkerSize,
      scale: options.scale,
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
    this.#marker.placeAt(this.#pivotPosition);
  }

  handleScroll(
    scrollY: number
  ): boolean {
    const step = this.#scale.length(this.#trailScrollStep);
    this.#targetTrailDistance = this.#clampTrail(
      this.#targetTrailDistance - (scrollY * step)
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
    const { body, deltaTime, responsiveness } = pose;

    this.#targetTrailDistance = this.#clampTrail(this.#targetTrailDistance);
    this.#trailDistance = dampScalar(
      this.#clampTrail(this.#trailDistance),
      this.#targetTrailDistance,
      smoothingFactor(responsiveness, deltaTime),
      this.#scale
    );

    this.#forward.set(0, 0, -1).applyQuaternion(body.orientation);
    body.position
      .copy(this.#pivotPosition)
      .addScaledVector(this.#forward, -this.#trailDistance);
    this.#marker.placeAt(this.#pivotPosition);
  }

  #clampTrail(
    distance: number
  ): number {
    return this.#scale.clamp(this.#trailRange, distance);
  }

  dispose(): void {
    this.#marker.dispose();
  }
}
