// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { snapValue } from "./snapping.ts";
import type {
  AreaAxis,
  AxisRange
} from "./types.ts";
import type { Vector3Like } from "../types.ts";

export interface AxisConstraintsOptions {
  /**
   * Absolute grid step; `null` disables snapping.
   */
  snap?: number | Vector3Like | null;
  /**
   * Minimum extent; takes precedence over `bounds`.
   */
  minSize?: Vector3Like | null;
  /**
   * Parent-space clamp volume, read live and never mutated.
   */
  bounds?: THREE.Box3 | null;
}

/**
 * Resolves the snapping step, the minimum extent and the clamp range that apply to one axis.
 */
export class AxisConstraints {
  readonly snap: number | Vector3Like | null;
  readonly minSize: Vector3Like | null;
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

  stepFor(
    axis: AreaAxis,
    free = false
  ): number {
    const { snap } = this;
    if (free || snap === null) {
      return 0;
    }

    return typeof snap === "number" ? snap : snap[axis];
  }

  snapOn(
    axis: AreaAxis,
    value: number,
    free = false
  ): number {
    return snapValue(
      value,
      this.stepFor(axis, free)
    );
  }

  minSizeFor(
    axis: AreaAxis
  ): number {
    if (this.minSize !== null) {
      return this.minSize[axis];
    }

    const step = this.stepFor(axis);

    return step > 0 ? step : 1;
  }

  rangeFor(
    axis: AreaAxis
  ): AxisRange | null {
    const { bounds } = this;

    return bounds === null
      ? null
      : { min: bounds.min[axis], max: bounds.max[axis] };
  }
}
