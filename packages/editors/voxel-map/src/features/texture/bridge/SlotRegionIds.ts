// Import Third-party Dependencies
import type { TilesetSlot } from "@jolly-pixel/voxel.renderer";
import { BlockProjection } from "@jolly-pixel/asset.voxel-map/client";

export class SlotRegionIds {
  readonly slot: TilesetSlot;

  constructor(
    slot: TilesetSlot
  ) {
    this.slot = slot;
  }

  blockIdOf(
    regionId: string
  ): number | null {
    const localId = BlockProjection.localBlockIdOf(regionId);

    return localId === null ? null : this.slot.blockId(localId);
  }

  regionIdOf(
    blockId: number
  ): string | null {
    return this.slot.owns(blockId) ?
      BlockProjection.regionIdOf(this.slot.localBlockId(blockId)) :
      null;
  }
}
