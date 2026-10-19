// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type AxisSign,
  AXIS_DIRECTION
} from "../../../common/math/axes.ts";
import { RotateGesture } from "../../../common/interaction/RotateGesture.ts";
import {
  snapQuarterTurns,
  unwrapAngle
} from "./quarterTurns.ts";

// CONSTANTS
const kMinRadius = 0.5;
const kClickTravel = 4;

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

    const gesture = RotateGesture.begin({
      ray,
      axis: AXIS_DIRECTION.y,
      origin,
      eye,
      radius: Math.max(
        Math.hypot(corner.x - origin.x, corner.z - origin.z),
        kMinRadius
      )
    });

    return gesture === null ? null : new RotateDrag(gesture, direction, press);
  }

  readonly direction: AxisSign;

  #gesture: RotateGesture;
  #angle = 0;
  #turns = 0;
  #pressX: number;
  #pressY: number;
  #travel = 0;

  constructor(
    gesture: RotateGesture,
    direction: AxisSign,
    press: PointerEvent
  ) {
    this.#gesture = gesture;
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

    this.#angle = this.#gesture.angular ? unwrapAngle(this.#angle, angle) : angle;

    const turns = snapQuarterTurns(this.#angle, this.#turns);
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
