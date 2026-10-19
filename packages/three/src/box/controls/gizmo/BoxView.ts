// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { eyeDirection } from "../../../common/screen/eyeDirection.ts";
import { screenScaleFactor } from "../../../common/screen/scaleFactor.ts";
import type { BoxVolume } from "../../BoxVolume.ts";

// CONSTANTS
const kCenter = new THREE.Vector3();
const kWorld = new THREE.Vector3();
const kInverse = new THREE.Matrix4();

export type PivotResolver = (
  box: BoxVolume,
  target: THREE.Vector3
) => THREE.Vector3;

export interface BoxViewOptions {
  camera: THREE.Camera;
  handleSize: number;
  pivot: PivotResolver;
}

export class BoxView {
  readonly camera: THREE.Camera;
  readonly size = new THREE.Vector3();
  readonly position = new THREE.Vector3();
  readonly pivot = new THREE.Vector3();
  readonly eye = new THREE.Vector3();
  readonly matrixWorld = new THREE.Matrix4();

  #handleSize: number;
  #pivotResolver: PivotResolver;

  constructor(
    options: BoxViewOptions
  ) {
    this.camera = options.camera;
    this.#handleSize = options.handleSize;
    this.#pivotResolver = options.pivot;
  }

  update(
    box: BoxVolume
  ): void {
    box.copySizeTo(this.size);
    this.position.copy(box.position);
    this.#pivotResolver(box, this.pivot);
    this.matrixWorld.copy(box.matrixWorld);

    kCenter.copy(this.size).multiplyScalar(0.5);
    eyeDirection(this.camera, this.toWorld(kCenter, kCenter), this.eye)
      .transformDirection(kInverse.copy(this.matrixWorld).invert());
  }

  toWorld(
    local: THREE.Vector3Like,
    target: THREE.Vector3
  ): THREE.Vector3 {
    return target.copy(local).applyMatrix4(this.matrixWorld);
  }

  handleScale(
    local: THREE.Vector3Like
  ): number {
    return screenScaleFactor(this.camera, this.toWorld(local, kWorld)) *
      this.#handleSize;
  }
}
