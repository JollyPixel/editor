// Import Third-party Dependencies
import type {
  VoxelBlockUsage,
  VoxelLayerUsage
} from "@jolly-pixel/voxel.renderer";
import { formatCount } from "@jolly-pixel/ui";

export class BlockUsage {
  static orphanMessage(
    voxels: number,
    blockIds: readonly number[]
  ): string {
    const ids = blockIds.map((id) => `#${id}`).join(", ");

    return `${formatCount(voxels, "voxel")} of deleted blocks (${ids}) ` +
      "cannot be drawn. Remove them from every layer?";
  }

  readonly blockId: number;
  readonly voxels: number;
  readonly layers: readonly VoxelLayerUsage[];

  constructor(
    usage: VoxelBlockUsage
  ) {
    this.blockId = usage.blockId;
    this.voxels = usage.voxels;
    this.layers = [...usage.layers];

    Object.freeze(this);
  }

  get unused(): boolean {
    return this.voxels === 0;
  }

  get summary(): string {
    if (this.unused) {
      return "Not placed in the map";
    }

    return `${formatCount(this.voxels, "voxel")} in ` +
      formatCount(this.layers.length, "layer");
  }

  get removalMessage(): string {
    if (this.unused) {
      return "No voxel uses this block.";
    }

    return `Used by ${this.summary}. ` +
      "Those voxels stay in the map but are no longer drawn.";
  }
}
