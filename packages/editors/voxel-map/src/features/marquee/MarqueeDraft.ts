// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { CellRegion } from "../placement/CellRegion.ts";

export class MarqueeDraft {
  static begin(
    layerName: string,
    start: VoxelCoord
  ): MarqueeDraft {
    return new MarqueeDraft(
      layerName,
      start,
      start
    );
  }

  readonly layerName: string;
  readonly start: Readonly<VoxelCoord>;
  readonly region: CellRegion;

  constructor(
    layerName: string,
    start: VoxelCoord,
    corner: VoxelCoord
  ) {
    this.layerName = layerName;
    this.start = Object.freeze({
      x: start.x,
      y: start.y,
      z: start.z
    });
    this.region = CellRegion.spanning(this.start, corner);

    Object.freeze(this);
  }

  stretchedTo(
    corner: VoxelCoord
  ): MarqueeDraft {
    return new MarqueeDraft(
      this.layerName,
      this.start,
      corner
    );
  }

  equals(
    other: MarqueeDraft | null
  ): boolean {
    return other !== null &&
      other.layerName === this.layerName &&
      other.region.equals(this.region);
  }
}
