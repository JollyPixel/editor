// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { Axis } from "../../../common/math/axes.ts";
import {
  type SnapStep,
  resolveSnapStep,
  snapValue
} from "../../../common/math/snap.ts";
import type { AxisRange } from "../../types.ts";

export interface AxisConstraintsOptions {
  /**
   * Absolute grid step; `null` disables snapping.
   */
  snap?: SnapStep;
  /**
   * Minimum extent; takes precedence over `bounds`.
   */
  minSize?: THREE.Vector3Like | null;
  /**
   * Parent-space clamp volume, read live and never mutated.
   */
  bounds?: THREE.Box3 | null;
}

export class AxisConstraints {
  readonly snap: SnapStep;
  readonly minSize: THREE.Vector3Like | null;
  readonly bounds: THREE.Box3 | null;

  constructor(
    options: AxisConstraintsOptions = {}
  ) {
    const {
      snap = null,
      minSize = null,
      bounds = null
    } = options;

    this.snap = snap;
    this.minSize = minSize;
    this.bounds = bounds;
  }

  axisStep(
    axis: Axis,
    free = false
  ): number {
    return free ? 0 : resolveSnapStep(this.snap, axis);
  }

  snapOn(
    axis: Axis,
    value: number,
    free = false
  ): number {
    return snapValue(
      value,
      this.axisStep(axis, free)
    );
  }

  axisMinSize(
    axis: Axis
  ): number {
    if (this.minSize !== null) {
      return this.minSize[axis];
    }

    const step = this.axisStep(axis);

    return step > 0 ? step : 1;
  }

  axisRange(
    axis: Axis
  ): AxisRange | null {
    const { bounds } = this;

    return bounds === null
      ? null
      : { min: bounds.min[axis], max: bounds.max[axis] };
  }
}
