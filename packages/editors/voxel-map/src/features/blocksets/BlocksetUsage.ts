// Import Third-party Dependencies
import type { VoxelBlocksetUsage } from "@jolly-pixel/voxel.renderer";
import { formatCount } from "@jolly-pixel/ui";

export class BlocksetUsage {
  readonly blocksetId: string;
  readonly blocks: readonly number[];
  readonly voxels: number;

  constructor(
    usage: VoxelBlocksetUsage
  ) {
    this.blocksetId = usage.blocksetId;
    this.blocks = [...usage.blocks];
    this.voxels = usage.voxels;

    Object.freeze(this);
  }

  get unused(): boolean {
    return this.blocks.length === 0 && this.voxels === 0;
  }

  get summary(): string {
    return `Used by ${formatCount(this.blocks.length, "block")}, ` +
      `${formatCount(this.voxels, "voxel")} in the map.`;
  }

  get removalMessage(): string {
    const count = this.blocks.length;
    if (count === 0) {
      return "No block uses this blockset.";
    }

    const placed = this.voxels === 0 ?
      "none placed in the map" :
      `${formatCount(this.voxels, "voxel")} in the map`;
    const verb = count === 1 ?
      "comes from this blockset and leaves the map with it" :
      "come from this blockset and leave the map with it";

    return `${formatCount(count, "block")} (${placed}) ${verb}.`;
  }
}
