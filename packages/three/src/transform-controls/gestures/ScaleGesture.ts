// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Axis,
  AXES
} from "../../common/axes.ts";
import { snapValue } from "../../common/snap.ts";
import { PLANE_AXES } from "../handles/handleId.ts";
import {
  type GestureContext,
  axisDragPlane,
  facingDragPlane,
  frameAxis,
  viewDirection
} from "./GestureContext.ts";

// CONSTANTS
const kMinFactor = 1e-3;
const kStartEpsilon = 1e-6;

const kDirection = new THREE.Vector3();
const kHit = new THREE.Vector3();

type ScaleMeasure =
  | {
    kind: "ratio";
    direction: THREE.Vector3 | null;
    start: number;
  }
  | {
    kind: "offset";
    direction: THREE.Vector3;
    size: number;
  };

export interface ScaleGestureInit {
  plane: THREE.Plane;
  axes: readonly Axis[];
  origin: THREE.Vector3;
  startHit: THREE.Vector3;
  startScale: THREE.Vector3;
  measure: ScaleMeasure;
}

export class ScaleGesture {
  readonly mode = "scale";

  #plane: THREE.Plane;
  #axes: readonly Axis[];
  #origin: THREE.Vector3;
  #startHit: THREE.Vector3;
  #startScale: THREE.Vector3;
  #measure: ScaleMeasure;

  constructor(
    init: ScaleGestureInit
  ) {
    this.#plane = init.plane;
    this.#axes = init.axes;
    this.#origin = init.origin;
    this.#startHit = init.startHit;
    this.#startScale = init.startScale;
    this.#measure = init.measure;
  }

  static begin(
    context: GestureContext,
    startScale: THREE.Vector3
  ): ScaleGesture | null {
    const { handle } = context;
    const plane = new THREE.Plane();
    let axes: readonly Axis[] = AXES;
    let direction: THREE.Vector3 | null = null;

    if (handle.kind === "axis") {
      direction = frameAxis(context, handle.axis, new THREE.Vector3());
      if (!axisDragPlane(context, direction, plane)) {
        return null;
      }
      axes = [handle.axis];
    }
    else if (handle.kind === "plane") {
      frameAxis(context, handle.normal, kDirection);
      if (!facingDragPlane(context, kDirection, plane)) {
        return null;
      }
      axes = PLANE_AXES[handle.normal];
    }
    else if (handle.kind === "center") {
      plane.setFromNormalAndCoplanarPoint(
        viewDirection(context, kDirection),
        context.origin
      );
    }
    else {
      return null;
    }

    if (context.ray.intersectPlane(plane, kHit) === null) {
      return null;
    }

    const startHit = kHit.clone();
    const measure = handle.kind === "center"
      ? growDirectionMeasure(context)
      : ratioMeasure(context, startHit, direction);
    if (measure === null) {
      return null;
    }

    return new ScaleGesture({
      plane,
      axes,
      origin: context.origin.clone(),
      startHit,
      startScale: startScale.clone(),
      measure
    });
  }

  update(
    ray: THREE.Ray,
    snap: number | null,
    target: THREE.Vector3
  ): boolean {
    if (ray.intersectPlane(this.#plane, kHit) === null) {
      return false;
    }

    const factor = Math.max(this.#factorAt(kHit), kMinFactor);
    target.setScalar(1);
    for (const axis of this.#axes) {
      target[axis] = this.#snappedFactor(axis, factor, snap);
    }

    return true;
  }

  #factorAt(
    hit: THREE.Vector3
  ): number {
    const measure = this.#measure;
    if (measure.kind === "offset") {
      const travelled = hit.sub(this.#startHit).dot(measure.direction);

      return 1 + (travelled / measure.size);
    }

    hit.sub(this.#origin);

    return measure.direction === null
      ? hit.length() / measure.start
      : hit.dot(measure.direction) / measure.start;
  }

  #snappedFactor(
    axis: Axis,
    factor: number,
    snap: number | null
  ): number {
    const start = this.#startScale[axis];
    if (snap === null || start === 0) {
      return factor;
    }

    const snapped = snapValue(start * factor, snap);

    return (snapped === 0 ? Math.sign(start) * snap : snapped) / start;
  }
}

function ratioMeasure(
  context: GestureContext,
  startHit: THREE.Vector3,
  direction: THREE.Vector3 | null
): ScaleMeasure | null {
  kHit.subVectors(startHit, context.origin);
  const start = direction === null
    ? kHit.length()
    : kHit.dot(direction);
  if (Math.abs(start) < kStartEpsilon) {
    return null;
  }

  return {
    kind: "ratio",
    direction,
    start
  };
}

function growDirectionMeasure(
  context: GestureContext
): ScaleMeasure {
  return {
    kind: "offset",
    direction: new THREE.Vector3(1, 1, 0)
      .normalize()
      .applyQuaternion(context.cameraQuaternion),
    size: context.size
  };
}
