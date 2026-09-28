// Import Internal Dependencies
import type { VoxelObjectJSON } from "./types.ts";

export interface VoxelFootprintJSON {
  width: number;
  height: number;
}

/**
 * Immutable whole-cell area an object covers on the ground plane.
 * Width spans x and height spans z.
 */
export class VoxelFootprint {
  static readonly Unit: VoxelFootprint = new VoxelFootprint(1, 1);

  static normalizeExtent(
    value: number
  ): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 1;
    }

    return Math.max(1, Math.round(value));
  }

  static of(
    object: Pick<VoxelObjectJSON, "width" | "height">
  ): VoxelFootprint {
    return new VoxelFootprint(
      object.width ?? 1,
      object.height ?? 1
    );
  }

  readonly width: number;
  readonly height: number;

  constructor(
    width: number,
    height: number
  ) {
    this.width = VoxelFootprint.normalizeExtent(width);
    this.height = VoxelFootprint.normalizeExtent(height);

    Object.freeze(this);
  }

  equals(
    other: VoxelFootprint
  ): boolean {
    return this.width === other.width &&
      this.height === other.height;
  }

  toJSON(): VoxelFootprintJSON {
    return {
      width: this.width,
      height: this.height
    };
  }
}
