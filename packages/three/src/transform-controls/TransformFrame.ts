// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  TransformMode,
  TransformOrientation,
  TransformPivot
} from "./types.ts";

// CONSTANTS
const kNamedOrientations = ["world", "local", "parent", "view"] as const;

export type ResolvedOrientation =
  | typeof kNamedOrientations[number]
  | THREE.Quaternion;
export type ResolvedPivot =
  | "origin"
  | THREE.Object3D
  | THREE.Vector3;

export class TransformFrame {
  #orientation: ResolvedOrientation = "world";
  #pivot: ResolvedPivot = "origin";

  get orientation(): ResolvedOrientation {
    return this.#orientation instanceof THREE.Quaternion
      ? this.#orientation.clone()
      : this.#orientation;
  }

  set orientation(
    orientation: TransformOrientation
  ) {
    if (typeof orientation !== "string") {
      const quaternion = new THREE.Quaternion(
        orientation.x,
        orientation.y,
        orientation.z,
        orientation.w
      );
      if (
        !Number.isFinite(quaternion.lengthSq()) ||
        quaternion.lengthSq() === 0
      ) {
        throw new RangeError(
          "Transform orientation must be a finite, non-zero quaternion"
        );
      }

      this.#orientation = quaternion.normalize();

      return;
    }
    if (!kNamedOrientations.includes(orientation)) {
      throw new TypeError(`Unknown transform orientation: ${orientation}`);
    }

    this.#orientation = orientation;
  }

  get pivot(): ResolvedPivot {
    return this.#pivot instanceof THREE.Vector3
      ? this.#pivot.clone()
      : this.#pivot;
  }

  set pivot(
    pivot: TransformPivot
  ) {
    if (pivot === "origin" || isObject3D(pivot)) {
      this.#pivot = pivot;

      return;
    }
    if (typeof pivot === "string") {
      throw new TypeError(`Unknown transform pivot: ${pivot}`);
    }

    const point = new THREE.Vector3(pivot.x, pivot.y, pivot.z);
    if (!Number.isFinite(point.lengthSq())) {
      throw new RangeError("Transform pivot must be a finite point");
    }

    this.#pivot = point;
  }

  resolveOrigin(
    target: THREE.Object3D,
    origin: THREE.Vector3
  ): THREE.Vector3 {
    const pivot = this.#pivot;
    if (pivot === "origin") {
      return target.getWorldPosition(origin);
    }
    if (pivot instanceof THREE.Vector3) {
      target.updateWorldMatrix(true, false);

      return target.localToWorld(origin.copy(pivot));
    }

    return pivot.getWorldPosition(origin);
  }

  resolveQuaternion(
    target: THREE.Object3D,
    camera: THREE.Camera,
    mode: TransformMode,
    quaternion: THREE.Quaternion
  ): THREE.Quaternion {
    const orientation = mode === "scale" ? "local" : this.#orientation;
    if (orientation instanceof THREE.Quaternion) {
      return quaternion.copy(orientation);
    }

    switch (orientation) {
      case "local":
        return target.getWorldQuaternion(quaternion);
      case "parent":
        return target.parent === null
          ? quaternion.identity()
          : target.parent.getWorldQuaternion(quaternion);
      case "view":
        return camera.getWorldQuaternion(quaternion);
      default:
        return quaternion.identity();
    }
  }
}

function isObject3D(
  value: TransformPivot
): value is THREE.Object3D {
  return typeof value === "object" &&
    "isObject3D" in value &&
    value.isObject3D === true;
}
