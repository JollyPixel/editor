// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  disposeObject3D
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { createPivotMarker } from "./pivotMarker.ts";

// CONSTANTS
const kSmoothingSnapEpsilon = 1e-3;

export interface OrbitFocusOptions {
  /**
   * Bounds for the scroll-adjusted pivot distance while engaged.
   */
  minPivotDistance: number;
  maxPivotDistance: number;
  /**
   * Distance nudged per key press while orbiting.
   */
  pivotNudgeStep: number;
  /**
   * Resolves the scene root lazily, on first use.
   */
  sceneProvider: () => THREE.Object3D;
}

export type OrbitFocusScrollOutcome = "engaged" | "inactive";

export class OrbitFocus {
  #minPivotDistance: number;
  #maxPivotDistance: number;
  #pivotNudgeStep: number;
  #sceneProvider: () => THREE.Object3D;

  #hasPivot = false;
  #isOrbiting = false;
  #pivotDistance = 0;
  #targetPivotDistance = 0;
  #pivotMarker: THREE.Object3D | null = null;

  #pivotPoint = new THREE.Vector3();
  #targetPivotPoint = new THREE.Vector3();
  #orbitOffset = new THREE.Vector3();
  #nudgeStep = new THREE.Vector3();
  #lookMatrix = new THREE.Matrix4();
  #euler = new THREE.Euler(0, 0, 0, "YXZ");
  #orientation = new THREE.Quaternion();

  constructor(
    options: OrbitFocusOptions
  ) {
    this.#minPivotDistance = options.minPivotDistance;
    this.#maxPivotDistance = options.maxPivotDistance;
    this.#pivotNudgeStep = options.pivotNudgeStep;
    this.#sceneProvider = options.sceneProvider;
  }

  get isOrbiting(): boolean {
    return this.#isOrbiting;
  }

  get pivot(): THREE.Vector3Like | null {
    return this.#hasPivot ? this.#pivotPoint : null;
  }

  #clampPivotDistance(
    distance: number
  ): number {
    return Math.min(
      this.#maxPivotDistance,
      Math.max(this.#minPivotDistance, distance)
    );
  }

  enter(
    point: THREE.Vector3Like | undefined,
    cameraPosition: THREE.Vector3,
    currentYaw: number,
    currentPitch: number,
    up: THREE.Vector3
  ): { yaw: number; pitch: number; } | false {
    if (this.#isOrbiting) {
      return false;
    }

    this.#pivotPoint.copy(point ?? cameraPosition);
    this.#targetPivotPoint.copy(this.#pivotPoint);
    this.#pivotDistance = this.#clampPivotDistance(
      cameraPosition.distanceTo(this.#pivotPoint)
    );
    this.#targetPivotDistance = this.#pivotDistance;
    this.#hasPivot = true;
    this.#isOrbiting = true;

    const marker = this.#ensureMarker();
    marker.position.copy(this.#pivotPoint);
    this.#showMarker();

    if (point === undefined) {
      return { yaw: currentYaw, pitch: currentPitch };
    }

    this.#orientation.setFromRotationMatrix(
      this.#lookMatrix.lookAt(cameraPosition, this.#pivotPoint, up)
    );
    this.#euler.setFromQuaternion(this.#orientation, "YXZ");

    return { yaw: this.#euler.y, pitch: this.#euler.x };
  }

  exit(): void {
    this.#hasPivot = false;
    this.#isOrbiting = false;
    this.#hideMarker();
  }

  updatePose(
    transform: Actor["transform"],
    yaw: number,
    pitch: number,
    deltaTime: number,
    responsiveness: number
  ): void {
    const smoothing = 1 - Math.exp(-responsiveness * deltaTime);

    this.#pivotDistance += (this.#targetPivotDistance - this.#pivotDistance) * smoothing;
    if (Math.abs(this.#targetPivotDistance - this.#pivotDistance) < kSmoothingSnapEpsilon) {
      this.#pivotDistance = this.#targetPivotDistance;
    }

    this.#pivotPoint.lerp(this.#targetPivotPoint, smoothing);
    if (this.#pivotPoint.distanceToSquared(this.#targetPivotPoint) < kSmoothingSnapEpsilon ** 2) {
      this.#pivotPoint.copy(this.#targetPivotPoint);
    }

    this.#euler.set(pitch, yaw, 0);
    this.#orientation.setFromEuler(this.#euler);
    this.#orbitOffset
      .set(0, 0, 1)
      .applyQuaternion(this.#orientation)
      .multiplyScalar(this.#pivotDistance)
      .add(this.#pivotPoint);

    transform.setLocalPosition(this.#orbitOffset);
    transform.lookAt(this.#pivotPoint);

    if (this.#pivotMarker) {
      this.#pivotMarker.position.copy(this.#pivotPoint);
    }
  }

  handleScroll(
    scrollY: number,
    scrollSpeed: number
  ): OrbitFocusScrollOutcome {
    if (!this.#isOrbiting) {
      return "inactive";
    }

    this.#targetPivotDistance = this.#clampPivotDistance(
      this.#targetPivotDistance - scrollY * scrollSpeed
    );

    return "engaged";
  }

  #snapCardinal(
    vector: THREE.Vector3,
    sign: number
  ): THREE.Vector3 {
    return Math.abs(vector.x) >= Math.abs(vector.z) ?
      this.#nudgeStep.set(Math.sign(vector.x) * sign * this.#pivotNudgeStep, 0, 0) :
      this.#nudgeStep.set(0, 0, Math.sign(vector.z) * sign * this.#pivotNudgeStep);
  }

  nudge(
    input: Actor["world"]["input"],
    forward: THREE.Vector3,
    right: THREE.Vector3
  ): void {
    const { keyboard } = input;
    let step: THREE.Vector3 | null = null;

    if (keyboard.wasJustPressed("KeyW") || keyboard.wasJustPressed("ArrowUp")) {
      step = this.#snapCardinal(forward, 1);
    }
    else if (keyboard.wasJustPressed("KeyS") || keyboard.wasJustPressed("ArrowDown")) {
      step = this.#snapCardinal(forward, -1);
    }
    else if (keyboard.wasJustPressed("KeyD") || keyboard.wasJustPressed("ArrowRight")) {
      step = this.#snapCardinal(right, 1);
    }
    else if (keyboard.wasJustPressed("KeyA") || keyboard.wasJustPressed("ArrowLeft")) {
      step = this.#snapCardinal(right, -1);
    }
    else if (keyboard.wasJustPressed("Space")) {
      step = this.#nudgeStep.set(0, this.#pivotNudgeStep, 0);
    }
    else if (keyboard.wasJustPressed("ShiftLeft") || keyboard.wasJustPressed("ShiftRight")) {
      step = this.#nudgeStep.set(0, -this.#pivotNudgeStep, 0);
    }

    if (step === null) {
      return;
    }

    this.#targetPivotPoint.add(step);
  }

  #ensureMarker(): THREE.Object3D {
    if (this.#pivotMarker === null) {
      this.#pivotMarker = createPivotMarker();
      this.#sceneProvider().add(this.#pivotMarker);
    }

    return this.#pivotMarker;
  }

  #showMarker(): void {
    if (this.#pivotMarker) {
      this.#pivotMarker.visible = true;
    }
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
