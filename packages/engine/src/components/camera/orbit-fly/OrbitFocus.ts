// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { InputKeyboardAction } from "@jolly-pixel/controls";

// Import Internal Dependencies
import { PivotMarker } from "./pivotMarker.ts";
import {
  type CameraFocus,
  type CameraFocusEnterRequest,
  type CameraFocusInput,
  type CameraFocusOrientation,
  type CameraFocusPose,
  type CameraFocusTransform,
  dampScalar,
  dampVector,
  smoothingFactor
} from "./CameraFocus.ts";

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
  showPivotMarker: boolean;
  /**
   * Resolves the scene root lazily, on first use.
   */
  sceneProvider: () => THREE.Object3D;
}

export class OrbitFocus implements CameraFocus {
  #minPivotDistance: number;
  #maxPivotDistance: number;
  #pivotNudgeStep: number;
  #marker: PivotMarker;

  #hasPivot = false;
  #isOrbiting = false;
  #pivotDistance = 0;
  #targetPivotDistance = 0;

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
    this.#marker = new PivotMarker({
      enabled: options.showPivotMarker,
      sceneProvider: options.sceneProvider
    });
  }

  get isOrbiting(): boolean {
    return this.#isOrbiting;
  }

  get isLocked(): boolean {
    return this.#isOrbiting;
  }

  get pivot(): THREE.Vector3Like | null {
    return this.#hasPivot ? this.#pivotPoint : null;
  }

  #clampPivotDistance(
    distance: number
  ): number {
    return THREE.MathUtils.clamp(
      distance,
      this.#minPivotDistance,
      this.#maxPivotDistance
    );
  }

  enter(
    request: CameraFocusEnterRequest
  ): CameraFocusOrientation | null {
    if (this.#isOrbiting) {
      return null;
    }

    const { point, cameraPosition, yaw, pitch, up } = request;
    this.#pivotPoint.copy(point ?? cameraPosition);
    this.#targetPivotPoint.copy(this.#pivotPoint);
    this.#pivotDistance = this.#clampPivotDistance(
      cameraPosition.distanceTo(this.#pivotPoint)
    );
    this.#targetPivotDistance = this.#pivotDistance;
    this.#hasPivot = true;
    this.#isOrbiting = true;

    this.#marker.show();
    this.#marker.moveTo(this.#pivotPoint);

    if (point === undefined) {
      return { yaw, pitch };
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
    this.#marker.hide();
  }

  move(
    offset: THREE.Vector3,
    transform: CameraFocusTransform
  ): void {
    transform.moveGlobal(offset);
  }

  updatePose(
    pose: CameraFocusPose
  ): void {
    if (!this.#isOrbiting) {
      return;
    }

    const { transform, yaw, pitch, deltaTime, responsiveness } = pose;
    const smoothing = smoothingFactor(responsiveness, deltaTime);

    this.#pivotDistance = dampScalar(
      this.#pivotDistance,
      this.#targetPivotDistance,
      smoothing
    );
    dampVector(this.#pivotPoint, this.#targetPivotPoint, smoothing);

    this.#euler.set(pitch, yaw, 0);
    this.#orientation.setFromEuler(this.#euler);
    this.#orbitOffset
      .set(0, 0, 1)
      .applyQuaternion(this.#orientation)
      .multiplyScalar(this.#pivotDistance)
      .add(this.#pivotPoint);

    transform.setLocalPosition(this.#orbitOffset);
    transform.lookAt(this.#pivotPoint);
    this.#marker.moveTo(this.#pivotPoint);
  }

  handleScroll(
    scrollY: number,
    scrollSpeed: number
  ): boolean {
    if (!this.#isOrbiting) {
      return false;
    }

    this.#targetPivotDistance = this.#clampPivotDistance(
      this.#targetPivotDistance - (scrollY * scrollSpeed)
    );

    return true;
  }

  #snapCardinal(
    vector: THREE.Vector3,
    sign: number
  ): THREE.Vector3 {
    const step = sign * this.#pivotNudgeStep;

    return Math.abs(vector.x) >= Math.abs(vector.z) ?
      this.#nudgeStep.set(Math.sign(vector.x) * step, 0, 0) :
      this.#nudgeStep.set(0, 0, Math.sign(vector.z) * step);
  }

  nudge(
    input: CameraFocusInput,
    forward: THREE.Vector3,
    right: THREE.Vector3
  ): void {
    function pressed(
      ...codes: InputKeyboardAction[]
    ): boolean {
      return codes.some((code) => input.keyboard.wasJustPressed(code));
    }

    let step: THREE.Vector3 | null = null;
    if (pressed("KeyW", "ArrowUp")) {
      step = this.#snapCardinal(forward, 1);
    }
    else if (pressed("KeyS", "ArrowDown")) {
      step = this.#snapCardinal(forward, -1);
    }
    else if (pressed("KeyD", "ArrowRight")) {
      step = this.#snapCardinal(right, 1);
    }
    else if (pressed("KeyA", "ArrowLeft")) {
      step = this.#snapCardinal(right, -1);
    }
    else if (pressed("Space")) {
      step = this.#nudgeStep.set(0, this.#pivotNudgeStep, 0);
    }
    else if (pressed("ShiftLeft", "ShiftRight")) {
      step = this.#nudgeStep.set(0, -this.#pivotNudgeStep, 0);
    }

    if (step !== null) {
      this.#targetPivotPoint.add(step);
    }
  }

  dispose(): void {
    this.#marker.dispose();
  }
}
