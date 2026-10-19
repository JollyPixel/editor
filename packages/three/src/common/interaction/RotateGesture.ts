// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { snapValue } from "../math/snap.ts";

// CONSTANTS
const kAngularThreshold = 0.3;
const kStartEpsilon = 1e-6;

const kHit = new THREE.Vector3();
const kCross = new THREE.Vector3();

export interface RotateGestureOptions {
  ray: THREE.Ray;
  axis: THREE.Vector3;
  origin: THREE.Vector3;
  eye: THREE.Vector3;
  radius: number;
}

export interface RotateGestureInit {
  axis: THREE.Vector3;
  plane: THREE.Plane;
  origin: THREE.Vector3;
  startHit: THREE.Vector3;
  tangent: THREE.Vector3 | null;
  radius: number;
}

export class RotateGesture {
  readonly mode = "rotate";
  readonly axis: THREE.Vector3;
  readonly angular: boolean;

  #plane: THREE.Plane;
  #origin: THREE.Vector3;
  #startHit: THREE.Vector3;
  #startVector: THREE.Vector3;
  #tangent: THREE.Vector3 | null;
  #radius: number;

  static begin(
    options: RotateGestureOptions
  ): RotateGesture | null {
    const { ray, axis, origin, eye, radius } = options;
    const angular = Math.abs(eye.dot(axis)) >= kAngularThreshold;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      angular ? axis : eye,
      origin
    );
    if (ray.intersectPlane(plane, kHit) === null) {
      return null;
    }
    if (angular && kHit.distanceToSquared(origin) < kStartEpsilon) {
      return null;
    }

    return new RotateGesture({
      axis: axis.clone(),
      plane,
      origin: origin.clone(),
      startHit: kHit.clone(),
      tangent: angular ?
        null :
        new THREE.Vector3().crossVectors(axis, eye).normalize(),
      radius
    });
  }

  constructor(
    init: RotateGestureInit
  ) {
    this.axis = init.axis;
    this.angular = init.tangent === null;
    this.#plane = init.plane;
    this.#origin = init.origin;
    this.#startHit = init.startHit;
    this.#startVector = init.startHit.clone().sub(init.origin);
    this.#tangent = init.tangent;
    this.#radius = init.radius;
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
      : kHit.sub(this.#startHit).dot(this.#tangent) / this.#radius;

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
