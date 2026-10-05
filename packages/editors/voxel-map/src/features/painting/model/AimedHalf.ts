// Import Third-party Dependencies
import {
  VoxelTransform,
  packVoxel,
  type BlockComplements,
  type VoxelEntry,
  type VoxelPart
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelPaint } from "./BrushStroke.ts";

export class AimedHalf {
  static of(
    entry: VoxelEntry,
    aimed: VoxelPart
  ): AimedHalf | null {
    const { partner } = entry;
    if (partner === undefined) {
      return null;
    }

    const primary = {
      blockId: entry.blockId,
      transform: entry.transform
    };
    if (samePart(primary, aimed)) {
      return new AimedHalf(primary, partner);
    }

    return samePart(partner, aimed) ?
      new AimedHalf(partner, primary) :
      null;
  }

  readonly aimed: VoxelPart;
  readonly kept: VoxelPart;

  constructor(
    aimed: VoxelPart,
    kept: VoxelPart
  ) {
    this.aimed = { ...aimed };
    this.kept = { ...kept };
  }

  replacementFor(
    paint: VoxelPaint,
    complements: BlockComplements
  ): VoxelPart | null {
    const painted = {
      blockId: paint.blockId,
      transform: new VoxelTransform(paint).packed
    };
    const turned = {
      blockId: paint.blockId,
      transform: this.aimed.transform
    };

    return [painted, turned].find(
      (part) => complements.complements(packOf(this.kept), packOf(part))
    ) ?? null;
  }
}

function samePart(
  left: VoxelPart,
  right: VoxelPart
): boolean {
  return left.blockId === right.blockId &&
    left.transform === right.transform;
}

function packOf(
  part: VoxelPart
): number {
  return packVoxel(part.blockId, part.transform);
}
