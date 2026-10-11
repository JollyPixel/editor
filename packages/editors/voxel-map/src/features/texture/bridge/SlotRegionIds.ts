// Import Third-party Dependencies
import type { BlocksetSlot } from "@jolly-pixel/voxel.renderer";
import { BlockProjection } from "@jolly-pixel/asset.voxel-map/client";

export class SlotRegionIds {
  readonly slot: BlocksetSlot;

  constructor(
    slot: BlocksetSlot
  ) {
    this.slot = slot;
  }

  resolveBlockId(
    regionId: string
  ): number | null {
    const localId = BlockProjection.localBlockIdOf(regionId);

    return localId === null ? null : this.slot.composeBlockId(localId);
  }

  resolveRegionId(
    blockId: number
  ): string | null {
    return this.slot.ownsBlockId(blockId) ?
      BlockProjection.regionIdOf(this.slot.decodeLocalBlockId(blockId)) :
      null;
  }
}
