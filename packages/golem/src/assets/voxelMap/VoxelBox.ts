// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// CONSTANTS
export const MAX_BOX_CELLS = 1_000_000;

export interface VoxelBoxJSON {
  /**
   * The lowest cell, included.
   */
  min: VoxelCoord;
  /**
   * The highest cell, included.
   */
  max: VoxelCoord;
}

export class VoxelBox implements VoxelBoxJSON {
  readonly min: VoxelCoord;
  readonly max: VoxelCoord;

  constructor(
    box: VoxelBoxJSON
  ) {
    const { min, max } = box;
    for (const axis of ["x", "y", "z"] as const) {
      if (!Number.isInteger(min[axis]) || !Number.isInteger(max[axis])) {
        throw new RangeError(`The box corners must be whole cells, got ${JSON.stringify(box)}.`);
      }
      if (min[axis] > max[axis]) {
        throw new RangeError(`The box min.${axis} is above its max.${axis}.`);
      }
    }
    this.min = { ...min };
    this.max = { ...max };
    if (this.cellCount > MAX_BOX_CELLS) {
      throw new RangeError(
        `The box holds ${this.cellCount} cells, more than ${MAX_BOX_CELLS}: split it.`
      );
    }
  }

  get cellCount(): number {
    return (this.max.x - this.min.x + 1) *
      (this.max.y - this.min.y + 1) *
      (this.max.z - this.min.z + 1);
  }

  * cells(): IterableIterator<VoxelCoord> {
    for (let y = this.min.y; y <= this.max.y; y++) {
      for (let z = this.min.z; z <= this.max.z; z++) {
        for (let x = this.min.x; x <= this.max.x; x++) {
          yield { x, y, z };
        }
      }
    }
  }
}
