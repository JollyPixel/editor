// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { AXES } from "../../common/math/axes.ts";
import {
  type SnapStep,
  resolveSnapStep,
  snapValue
} from "../../common/math/snap.ts";
import { PLANE_AXES } from "../handles/handleId.ts";
import {
  type GestureContext,
  axisDragPlane,
  facingDragPlane,
  frameAxis,
  viewDirection
} from "./GestureContext.ts";

// CONSTANTS
const kDirection = new THREE.Vector3();
const kHit = new THREE.Vector3();
const kFrom = new THREE.Vector3();

export interface TranslateGestureInit {
  plane: THREE.Plane;
  mask: THREE.Vector3;
  startHit: THREE.Vector3;
  start: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export class TranslateGesture {
  readonly mode = "translate";

  #plane: THREE.Plane;
  #mask: THREE.Vector3;
  #startHit: THREE.Vector3;
  #start: THREE.Vector3;
  #quaternion: THREE.Quaternion;
  #inverse: THREE.Quaternion;

  constructor(
    init: TranslateGestureInit
  ) {
    this.#plane = init.plane;
    this.#mask = init.mask;
    this.#startHit = init.startHit;
    this.#quaternion = init.quaternion;
    this.#inverse = init.quaternion.clone().invert();
    this.#start = init.start.clone().applyQuaternion(this.#inverse);
  }

  static begin(
    context: GestureContext,
    start: THREE.Vector3
  ): TranslateGesture | null {
    const { handle } = context;
    const plane = new THREE.Plane();
    const mask = new THREE.Vector3();

    if (handle.kind === "axis") {
      frameAxis(context, handle.axis, kDirection);
      if (!axisDragPlane(context, kDirection, plane)) {
        return null;
      }
      mask[handle.axis] = 1;
    }
    else if (handle.kind === "plane") {
      frameAxis(context, handle.normal, kDirection);
      if (!facingDragPlane(context, kDirection, plane)) {
        return null;
      }
      for (const axis of PLANE_AXES[handle.normal]) {
        mask[axis] = 1;
      }
    }
    else if (handle.kind === "center") {
      plane.setFromNormalAndCoplanarPoint(
        viewDirection(context, kDirection),
        context.origin
      );
      mask.setScalar(1);
    }
    else {
      return null;
    }

    if (context.ray.intersectPlane(plane, kHit) === null) {
      return null;
    }

    return new TranslateGesture({
      plane,
      mask,
      startHit: kHit.clone(),
      start,
      quaternion: context.quaternion.clone()
    });
  }

  update(
    ray: THREE.Ray,
    snap: SnapStep,
    target: THREE.Vector3,
    grid: THREE.Vector3 | null
  ): boolean {
    if (ray.intersectPlane(this.#plane, kHit) === null) {
      return false;
    }

    if (grid === null) {
      kFrom.setScalar(0);
    }
    else {
      kFrom.subVectors(this.#start, grid);
    }
    target
      .subVectors(kHit, this.#startHit)
      .applyQuaternion(this.#inverse)
      .multiply(this.#mask);
    for (const axis of AXES) {
      if (this.#mask[axis] !== 0) {
        const step = resolveSnapStep(snap, axis);
        target[axis] = snapValue(kFrom[axis] + target[axis], step) -
          kFrom[axis];
      }
    }
    target.applyQuaternion(this.#quaternion);

    return true;
  }
}
