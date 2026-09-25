// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { ViewDistance } from "../world/ViewDistance.ts";
import type { ViewDistancePolicy } from "../VoxelView.ts";

export interface ChunkViewportOptions {
  focus: THREE.Vector3Like | null;
  viewDistance: ViewDistance;
  policy: ViewDistancePolicy;
  chunkSize: number;
}

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
      chunkSize
    } = options;

    this.focus = focus === null ? null : {
      x: focus.x,
      y: focus.y,
      z: focus.z
    };
    this.viewDistance = viewDistance;
    this.policy = policy;
    this.chunkSize = chunkSize;
  }

  get unbounded(): boolean {
    return this.focus === null || this.viewDistance.unlimited;
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
      this.focusMovedFrom(other.focus);
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
