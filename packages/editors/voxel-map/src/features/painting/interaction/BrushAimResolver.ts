// Import Third-party Dependencies
import * as THREE from "three";
import {
  voxelCellOf,
  voxelPositionOf,
  type VoxelCoord
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { castViewRay } from "../../../scene/viewFocus.ts";
import type { StrokeMode } from "../model/BrushStroke.ts";

// CONSTANTS
const kPlane = new THREE.Plane();
const kPlanePoint = new THREE.Vector3();
const kUp = new THREE.Vector3(0, 1, 0);

export interface BrushAim {
  place: VoxelCoord;
  remove: VoxelCoord;
}

export interface BrushAimResolverOptions {
  camera: THREE.PerspectiveCamera;
  solid: THREE.Object3D;
  groundPlaneSize: number;
  maxDistance: number;
}

/**
 * Resolves pointer coordinates to voxel cells without owning input state.
 */
export class BrushAimResolver {
  #camera: THREE.PerspectiveCamera;
  #solid: THREE.Object3D;
  #groundPlaneSize: number;
  #maxDistance: number;
  #raycaster = new THREE.Raycaster();

  constructor(
    options: BrushAimResolverOptions
  ) {
    this.#camera = options.camera;
    this.#solid = options.solid;
    this.#groundPlaneSize = options.groundPlaneSize;
    this.#maxDistance = options.maxDistance;
  }

  get maxDistance(): number {
    return this.#maxDistance;
  }

  set maxDistance(value: number) {
    this.#maxDistance = value;
  }

  resolve(
    pointer: THREE.Vector2
  ): BrushAim | null {
    const hit = castViewRay(this.#camera, this.#solid, {
      pointer,
      groundPlaneSize: this.#groundPlaneSize,
      raycaster: this.#raycaster
    });
    if (hit === null || hit.distance > this.#maxDistance) {
      return null;
    }

    return {
      place: voxelPositionOf(hit.point, hit.normal, "front"),
      remove: voxelPositionOf(
        hit.point,
        hit.normal,
        hit.ground ? "front" : "back"
      )
    };
  }

  aimAtHeight(
    pointer: THREE.Vector2,
    height: number,
    mode: StrokeMode
  ): VoxelCoord | null {
    this.#raycaster.setFromCamera(pointer, this.#camera);
    kPlane.set(kUp, -(height + 0.5));

    const point = this.#raycaster.ray.intersectPlane(kPlane, kPlanePoint);
    if (point === null) {
      return null;
    }

    const distance = point.distanceTo(this.#raycaster.ray.origin);
    if (distance > this.#maxDistance) {
      return null;
    }

    const cell = this.#surfaceCellAt(distance, mode) ?? voxelCellOf(point);

    return {
      x: cell.x,
      y: height,
      z: cell.z
    };
  }

  #surfaceCellAt(
    distance: number,
    mode: StrokeMode
  ): VoxelCoord | null {
    const [hit] = this.#raycaster.intersectObject(this.#solid, true);
    if (hit === undefined || hit.distance >= distance) {
      return null;
    }

    return voxelPositionOf(
      hit.point,
      hit.face?.normal ?? kUp,
      mode === "place" ? "front" : "back"
    );
  }
}
