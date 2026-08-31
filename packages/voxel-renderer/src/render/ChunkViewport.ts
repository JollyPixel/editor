// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { VoxelLayer } from "../world/VoxelLayer.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { ViewDistance } from "../world/ViewDistance.ts";
import type { ViewDistancePolicy } from "../VoxelEngine.types.ts";

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
    layer: VoxelLayer,
    chunk: VoxelChunk,
    retain: boolean
  ): boolean {
    if (this.unbounded) {
      return true;
    }

    const { x, y, z } = this.#centerOffset(
      layer,
      chunk
    );
    const { chunkSize } = this;

    return retain ?
      this.viewDistance.retains(x, y, z, chunkSize) :
      this.viewDistance.admits(x, y, z, chunkSize);
  }

  distanceSquaredTo(
    layer: VoxelLayer,
    chunk: VoxelChunk
  ): number {
    const { x, y, z } = this.#centerOffset(
      layer,
      chunk
    );

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
    layer: VoxelLayer,
    chunk: VoxelChunk
  ): THREE.Vector3Like {
    const { chunkSize, focus } = this;
    const half = chunkSize / 2;
    const offset = this.#offset;

    offset.x = (chunk.cx * chunkSize) + half + layer.offset.x - focus!.x;
    offset.y = (chunk.cy * chunkSize) + half + layer.offset.y - focus!.y;
    offset.z = (chunk.cz * chunkSize) + half + layer.offset.z - focus!.z;

    return offset;
  }
}
