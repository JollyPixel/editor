// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type AxisSign,
  AXIS_DIRECTION
} from "../../common/axes.ts";
import { RotateGesture } from "../../transform-controls/gestures/RotateGesture.ts";
import {
  quarterTurnsFor,
  unwrapAngle
} from "./quarterTurns.ts";

// CONSTANTS
const kAngularThreshold = 0.3;
const kStartEpsilon = 1e-6;
const kMinRadius = 0.5;
const kClickTravel = 4;

const kHit = new THREE.Vector3();

export interface RotateDragOptions {
  ray: THREE.Ray;
  origin: THREE.Vector3;
  corner: THREE.Vector3;
  eye: THREE.Vector3;
  direction: AxisSign;
  press: PointerEvent;
}

export class RotateDrag {
  static begin(
    options: RotateDragOptions
  ): RotateDrag | null {
    const {
      ray,
      origin,
      corner,
      eye,
      direction,
      press
    } = options;

    const angular = Math.abs(eye.y) >= kAngularThreshold;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      angular ? AXIS_DIRECTION.y : eye,
      origin
    );
    if (ray.intersectPlane(plane, kHit) === null) {
      return null;
    }
    if (angular && kHit.distanceToSquared(origin) < kStartEpsilon) {
      return null;
    }

    const gesture = new RotateGesture({
      axis: AXIS_DIRECTION.y.clone(),
      plane,
      origin: origin.clone(),
      startHit: kHit.clone(),
      tangent: angular
        ? null
        : new THREE.Vector3().crossVectors(AXIS_DIRECTION.y, eye).normalize(),
      size: Math.max(
        Math.hypot(corner.x - origin.x, corner.z - origin.z),
        kMinRadius
      )
    });

    return new RotateDrag(gesture, angular, direction, press);
  }

  readonly direction: AxisSign;

  #gesture: RotateGesture;
  #angular: boolean;
  #angle = 0;
  #turns = 0;
  #pressX: number;
  #pressY: number;
  #travel = 0;

  constructor(
    gesture: RotateGesture,
    angular: boolean,
    direction: AxisSign,
    press: PointerEvent
  ) {
    this.#gesture = gesture;
    this.#angular = angular;
    this.direction = direction;
    this.#pressX = press.clientX;
    this.#pressY = press.clientY;
  }

  get angle(): number {
    return this.#angle;
  }

  update(
    ray: THREE.Ray,
    event: PointerEvent
  ): AxisSign[] {
    this.#track(event);
    const angle = this.#gesture.update(ray, null);
    if (angle === null) {
      return [];
    }

    this.#angle = this.#angular ? unwrapAngle(this.#angle, angle) : angle;

    const turns = quarterTurnsFor(this.#angle, this.#turns);
    const steps: AxisSign[] = [];
    while (this.#turns !== turns) {
      const step: AxisSign = turns > this.#turns ? 1 : -1;
      this.#turns += step;
      steps.push(step);
    }

    return steps;
  }

  isClick(
    release: PointerEvent
  ): boolean {
    return this.#turns === 0 && this.#track(release) < kClickTravel;
  }

  #track(
    event: PointerEvent
  ): number {
    this.#travel = Math.max(
      this.#travel,
      Math.hypot(event.clientX - this.#pressX, event.clientY - this.#pressY)
    );

    return this.#travel;
  }
}
