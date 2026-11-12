// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { GizmoSnap } from "./gizmoSnap.ts";

// CONSTANTS
const kUp = new THREE.Vector3(0, 1, 0);
const kHit = new THREE.Vector3();

export type DragPlane = "ground" | "vertical";
export type DragSnap = Pick<GizmoSnap, "translate" | "grid">;

export interface DragFootprint {
  position: THREE.Vector3Like;
  bounds: THREE.Box3;
}

export interface DragPlacementOptions {
  plane: DragPlane;
  grab: THREE.Vector3Like;
  eye: THREE.Vector3Like;
  footprint: DragFootprint;
}

export class DragPlacement {
  #vertical: boolean;
  #plane = new THREE.Plane();
  #grab: THREE.Vector3;
  #position: THREE.Vector3;
  #lift: number;
  #centerOffset: THREE.Vector3;
  #restedAt: THREE.Vector3 | null = null;

  constructor(
    options: DragPlacementOptions
  ) {
    const { plane, grab, eye, footprint } = options;
    this.#vertical = plane === "vertical";
    this.#grab = new THREE.Vector3().copy(grab);
    this.#position = new THREE.Vector3().copy(footprint.position);
    this.#lift = this.#position.y - footprint.bounds.min.y;
    this.#centerOffset = footprint.bounds
      .getCenter(new THREE.Vector3())
      .sub(this.#position)
      .setY(0);

    if (this.#vertical) {
      const normal = new THREE.Vector3().subVectors(eye, this.#grab).setY(0);
      if (normal.lengthSq() === 0) {
        normal.set(1, 0, 0);
      }
      this.#plane.setFromNormalAndCoplanarPoint(normal.normalize(), this.#grab);
    }
    else {
      this.#plane.setFromNormalAndCoplanarPoint(kUp, this.#grab);
    }
  }

  get canRest(): boolean {
    return !this.#vertical;
  }

  follow(
    ray: THREE.Ray,
    surface: THREE.Vector3Like | null,
    snap: DragSnap,
    target: THREE.Vector3
  ): boolean {
    if (surface !== null && this.canRest) {
      this.#restOn(surface, snap, target);

      return true;
    }
    if (this.#restedAt !== null) {
      this.#regrab(ray, this.#restedAt);
      this.#restedAt = null;
    }

    return this.#slide(ray, snap, target);
  }

  #slide(
    ray: THREE.Ray,
    snap: DragSnap,
    target: THREE.Vector3
  ): boolean {
    if (ray.intersectPlane(this.#plane, kHit) === null) {
      return false;
    }

    target.copy(this.#position);
    if (this.#vertical) {
      target.y = snapped(target.y + kHit.y - this.#grab.y, snap);
    }
    else {
      target.x = snapped(target.x + kHit.x - this.#grab.x, snap);
      target.z = snapped(target.z + kHit.z - this.#grab.z, snap);
    }

    return true;
  }

  #restOn(
    surface: THREE.Vector3Like,
    snap: DragSnap,
    target: THREE.Vector3
  ): void {
    target.set(
      snapped(surface.x - this.#centerOffset.x, snap),
      surface.y + this.#lift,
      snapped(surface.z - this.#centerOffset.z, snap)
    );
    this.#restedAt = (this.#restedAt ?? new THREE.Vector3()).copy(target);
  }

  #regrab(
    ray: THREE.Ray,
    position: THREE.Vector3
  ): void {
    this.#position.copy(position);
    ray.closestPointToPoint(position, this.#grab);
    this.#plane.setFromNormalAndCoplanarPoint(kUp, this.#grab);
  }
}

function snapped(
  value: number,
  snap: DragSnap
): number {
  const { translate, grid = 0 } = snap;
  if (translate === undefined) {
    return value;
  }

  return (Math.round((value - grid) / translate) * translate) + grid + 0;
}
