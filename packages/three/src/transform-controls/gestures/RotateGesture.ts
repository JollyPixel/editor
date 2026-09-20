// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { snapValue } from "../../common/snap.ts";
import {
  type GestureContext,
  frameAxis,
  viewDirection
} from "./GestureContext.ts";

// CONSTANTS
const kAngularThreshold = 0.3;
const kStartEpsilon = 1e-6;

const kDirection = new THREE.Vector3();
const kHit = new THREE.Vector3();
const kCross = new THREE.Vector3();

export interface RotateGestureInit {
  axis: THREE.Vector3;
  plane: THREE.Plane;
  origin: THREE.Vector3;
  startHit: THREE.Vector3;
  /**
   * Screen-space fallback direction; `null` measures the true angle
   * around `axis`.
   */
  tangent: THREE.Vector3 | null;
  size: number;
}

export class RotateGesture {
  readonly mode = "rotate";
  readonly axis: THREE.Vector3;

  #plane: THREE.Plane;
  #origin: THREE.Vector3;
  #startHit: THREE.Vector3;
  #startVector: THREE.Vector3;
  #tangent: THREE.Vector3 | null;
  #size: number;

  constructor(
    init: RotateGestureInit
  ) {
    this.axis = init.axis;
    this.#plane = init.plane;
    this.#origin = init.origin;
    this.#startHit = init.startHit;
    this.#startVector = init.startHit.clone().sub(init.origin);
    this.#tangent = init.tangent;
    this.#size = init.size;
  }

  static begin(
    context: GestureContext
  ): RotateGesture | null {
    const { handle } = context;
    const axis = new THREE.Vector3();
    if (handle.kind === "axis") {
      frameAxis(context, handle.axis, axis);
    }
    else if (handle.kind === "view") {
      axis.copy(context.eye);
    }
    else {
      return null;
    }

    const angular = Math.abs(context.eye.dot(axis)) >= kAngularThreshold;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      angular ? axis : viewDirection(context, kDirection),
      context.origin
    );
    if (context.ray.intersectPlane(plane, kHit) === null) {
      return null;
    }
    if (
      angular &&
      kHit.distanceToSquared(context.origin) < kStartEpsilon
    ) {
      return null;
    }

    return new RotateGesture({
      axis,
      plane,
      origin: context.origin.clone(),
      startHit: kHit.clone(),
      tangent: angular
        ? null
        : new THREE.Vector3()
          .crossVectors(axis, context.eye)
          .normalize(),
      size: context.size
    });
  }

  update(
    ray: THREE.Ray,
    snap: number | null
  ): number | null {
    if (ray.intersectPlane(this.#plane, kHit) === null) {
      return null;
    }

    const angle = this.#tangent === null
      ? this.#angleAround(kHit)
      : kHit.sub(this.#startHit).dot(this.#tangent) / this.#size;

    return snapValue(angle, snap ?? 0);
  }

  #angleAround(
    hit: THREE.Vector3
  ): number {
    hit.sub(this.#origin);

    return Math.atan2(
      this.axis.dot(kCross.crossVectors(this.#startVector, hit)),
      this.#startVector.dot(hit)
    );
  }
}
