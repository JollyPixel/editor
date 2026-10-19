// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Axis,
  AXIS_DIRECTION
} from "../../../common/math/axes.ts";
import {
  type BoxAxisPolicy,
  axisPolicyIncludes
} from "../../types.ts";
import type { AxisConstraints } from "./AxisConstraints.ts";
import { moveAxis } from "./snapping.ts";

// CONSTANTS
const kGroundAxes: readonly Axis[] = ["x", "z"];
const kVerticalAxes: readonly Axis[] = ["y"];

const kPoint = new THREE.Vector3();

export interface MoveDragOptions {
  min: THREE.Vector3;
  hit: THREE.Vector3;
  vertical: boolean;
  verticalNormal: THREE.Vector3;
}

export interface MoveDragStep {
  ray: THREE.Ray;
  free: boolean;
  vertical: boolean;
  verticalNormal: THREE.Vector3;
  constraints: AxisConstraints;
  axes: BoxAxisPolicy;
}

export class MoveDrag {
  #grabOffset: THREE.Vector3;
  #grabPoint: THREE.Vector3;
  #plane = new THREE.Plane();
  #vertical: boolean;
  #locked = false;

  constructor(
    options: MoveDragOptions
  ) {
    const { min, hit, vertical, verticalNormal } = options;

    this.#grabOffset = hit.clone().sub(min);
    this.#grabPoint = hit.clone();
    this.#vertical = vertical;
    this.#orientPlane(verticalNormal);
  }

  update(
    step: MoveDragStep,
    min: THREE.Vector3,
    size: THREE.Vector3
  ): void {
    if (!this.#locked && step.vertical !== this.#vertical) {
      this.#vertical = step.vertical;
      this.#orientPlane(step.verticalNormal);
    }
    if (step.ray.intersectPlane(this.#plane, kPoint) === null) {
      return;
    }

    kPoint.sub(this.#grabOffset);
    const { constraints } = step;
    for (const axis of this.#vertical ? kVerticalAxes : kGroundAxes) {
      if (!axisPolicyIncludes(step.axes, axis)) {
        continue;
      }

      const next = moveAxis({
        target: constraints.snapOn(axis, kPoint[axis], step.free),
        size: size[axis],
        bounds: constraints.axisRange(axis)
      });
      if (next !== min[axis]) {
        min[axis] = next;
        this.#locked = true;
      }
    }
  }

  #orientPlane(
    verticalNormal: THREE.Vector3
  ): void {
    this.#plane.setFromNormalAndCoplanarPoint(
      this.#vertical ? verticalNormal : AXIS_DIRECTION.y,
      this.#grabPoint
    );
  }
}
