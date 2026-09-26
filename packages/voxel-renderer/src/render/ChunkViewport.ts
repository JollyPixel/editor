// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { ViewDistance } from "../world/ViewDistance.ts";
import type { ViewDistancePolicy } from "../VoxelView.ts";

export interface ChunkDetail {
  readonly far: boolean;
  readonly lod: number;
}

export interface ChunkViewportOptions {
  focus: THREE.Vector3Like | null;
  viewDistance: ViewDistance;
  policy: ViewDistancePolicy;
  chunkSize: number;
  farDistance?: number;
  lodDistance?: number;
}

// CONSTANTS
export const FULL_DETAIL: ChunkDetail = Object.freeze({
  far: false,
  lod: 0
});

/**
 * Immutable snapshot of where the camera looks from and how far chunks stay
 * meshed and drawn. The focus is copied, so a caller may keep mutating the
 * vector it passed in.
 */
export class ChunkViewport {
  readonly focus: THREE.Vector3Like | null;
  readonly viewDistance: ViewDistance;
  readonly policy: ViewDistancePolicy;
  readonly chunkSize: number;
  readonly farDistance: number;
  readonly lodDistance: number;

  #offset = {
    x: 0,
    y: 0,
    z: 0
  };

  constructor(
    options: ChunkViewportOptions
  ) {
    const {
      focus,
      viewDistance,
      policy,
      chunkSize,
      farDistance = Infinity,
      lodDistance = Infinity
    } = options;

    this.focus = focus === null ? null : {
      x: focus.x,
      y: focus.y,
      z: focus.z
    };
    this.viewDistance = viewDistance;
    this.policy = policy;
    this.chunkSize = chunkSize;
    this.farDistance = farDistance;
    this.lodDistance = lodDistance;
  }

  get unbounded(): boolean {
    return this.focus === null || this.viewDistance.unlimited;
  }

  get detailed(): boolean {
    return this.focus !== null &&
      (Number.isFinite(this.farDistance) || Number.isFinite(this.lodDistance));
  }

  contains(
    origin: THREE.Vector3Like,
    retain: boolean
  ): boolean {
    if (this.unbounded) {
      return true;
    }

    const { x, y, z } = this.#centerOffset(origin);
    const { chunkSize } = this;

    return retain ?
      this.viewDistance.retains(x, y, z, chunkSize) :
      this.viewDistance.admits(x, y, z, chunkSize);
  }

  detailOf(
    origin: THREE.Vector3Like,
    current: ChunkDetail = FULL_DETAIL
  ): ChunkDetail {
    if (!this.detailed) {
      return FULL_DETAIL;
    }

    const distance = Math.sqrt(this.distanceSquaredTo(origin));
    const far = this.#beyond(distance, this.farDistance, current.far);
    const lod = this.#beyond(distance, this.lodDistance, current.lod > 0) ?
      1 :
      0;
    if (far === current.far && lod === current.lod) {
      return current;
    }

    return {
      far,
      lod
    };
  }

  distanceSquaredTo(
    origin: THREE.Vector3Like
  ): number {
    const { x, y, z } = this.#centerOffset(origin);

    return (x * x) + (y * y) + (z * z);
  }

  focusMovedFrom(
    last: THREE.Vector3Like | null
  ): boolean {
    if (
      last === null ||
      this.focus === null
    ) {
      return true;
    }

    const { focus } = this;
    const threshold = this.chunkSize / 2;

    return Math.abs(focus.x - last.x) >= threshold ||
      Math.abs(focus.y - last.y) >= threshold ||
      Math.abs(focus.z - last.z) >= threshold;
  }

  differsFrom(
    other: ChunkViewport | null
  ): boolean {
    return other === null ||
      other.viewDistance !== this.viewDistance ||
      other.policy !== this.policy ||
      other.farDistance !== this.farDistance ||
      other.lodDistance !== this.lodDistance ||
      this.focusMovedFrom(other.focus);
  }

  #beyond(
    distance: number,
    threshold: number,
    currently: boolean
  ): boolean {
    const hysteresis = currently ? this.chunkSize / 2 : 0;

    return distance > threshold - hysteresis;
  }

  #centerOffset(
    origin: THREE.Vector3Like
  ): THREE.Vector3Like {
    const { chunkSize, focus } = this;
    const half = chunkSize / 2;
    const offset = this.#offset;

    offset.x = origin.x + half - focus!.x;
    offset.y = origin.y + half - focus!.y;
    offset.z = origin.z + half - focus!.z;

    return offset;
  }
}
