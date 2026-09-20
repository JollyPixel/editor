// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { BoxState } from "./types.ts";

// CONSTANTS
const kMinimumExtent = 1e-6;

export interface BoxVolumeOptions {
  /**
   * Extent along each axis, in world units.
   * @default { x: 1, y: 1, z: 1 }
   */
  size?: THREE.Vector3Like;
  /**
   * Min corner of the box.
   * @default { x: 0, y: 0, z: 0 }
   */
  position?: THREE.Vector3Like;
}

export abstract class BoxVolume extends THREE.Object3D {
  #size = new THREE.Vector3(1, 1, 1);
  #state: BoxState = "idle";
  #disposed = false;

  constructor(
    options: BoxVolumeOptions = {}
  ) {
    super();

    const { size, position } = options;
    if (position) {
      this.position.set(
        position.x,
        position.y,
        position.z
      );
    }
    if (size) {
      this.#clampSize(size);
    }
  }

  get size(): THREE.Vector3 {
    return this.#size.clone();
  }

  set size(
    size: THREE.Vector3Like
  ) {
    this.#clampSize(size);
    this.layout(this.#size);
  }

  copySizeTo(
    target = new THREE.Vector3()
  ): THREE.Vector3 {
    return target.copy(this.#size);
  }

  get min(): THREE.Vector3 {
    return this.position;
  }

  get state(): BoxState {
    return this.#state;
  }

  set state(
    state: BoxState
  ) {
    if (state === this.#state) {
      return;
    }

    this.#state = state;
    this.emphasize?.(state);
  }

  toBox3(
    target = new THREE.Box3()
  ): THREE.Box3 {
    target.min.copy(this.position);
    target.max.copy(this.position).add(this.#size);

    return target;
  }

  fromBox3(
    box: THREE.Box3
  ): void {
    this.position.copy(box.min);
    this.size = {
      x: box.max.x - box.min.x,
      y: box.max.y - box.min.y,
      z: box.max.z - box.min.z
    };
  }

  override dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.release();
  }

  protected abstract layout(
    size: THREE.Vector3
  ): void;

  protected abstract release(): void;

  protected emphasize?(
    state: BoxState
  ): void;

  #clampSize(
    size: THREE.Vector3Like
  ): void {
    this.#size.set(
      Math.max(size.x, kMinimumExtent),
      Math.max(size.y, kMinimumExtent),
      Math.max(size.z, kMinimumExtent)
    );
  }
}
