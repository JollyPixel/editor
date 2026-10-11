// Import Internal Dependencies
import type { BlockRegistry } from "./BlockRegistry.ts";
import type { BlockShapeRegistry } from "./shape/BlockShapeRegistry.ts";
import { ShapeOccupancy } from "./shape/ShapeOccupancy.ts";
import { VoxelTransform } from "../geometry/VoxelTransform.ts";
import {
  voxelBlockId,
  voxelTransform,
  type PackedVoxel
} from "../world/storage/packedVoxel.ts";

export interface BlockComplementsOptions {
  blocks: BlockRegistry;
  shapes: BlockShapeRegistry;
}

export class BlockComplements {
  #blocks: BlockRegistry;
  #shapes: BlockShapeRegistry;

  constructor(
    options: BlockComplementsOptions
  ) {
    this.#blocks = options.blocks;
    this.#shapes = options.shapes;
  }

  complements(
    a: PackedVoxel,
    b: PackedVoxel
  ): boolean {
    const first = this.resolveOccupancy(a);
    const second = this.resolveOccupancy(b);

    return first !== null &&
      second !== null &&
      first.complements(second);
  }

  resolveOccupancy(
    packed: PackedVoxel
  ): ShapeOccupancy | null {
    const block = this.#blocks.get(voxelBlockId(packed));
    const shape = block && this.#shapes.get(block.shapeId);

    return shape === undefined ?
      null :
      ShapeOccupancy.fromShape(shape, VoxelTransform.fromPacked(voxelTransform(packed)));
  }
}
