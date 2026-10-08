// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import { AIR_BLOCK_ID } from "../../blocks/BlockId.ts";
import {
  voxelBlockId,
  voxelTransform,
  VOXEL_ABSENT,
  type PackedVoxel
} from "../storage/packedVoxel.ts";
import {
  voxelPatch,
  VOXEL_PATCH_STRIDE,
  type VoxelPatch,
  type VoxelPatchCells,
  type VoxelPatchPartners
} from "./voxelPatch.ts";
import type { VoxelCellChange } from "../types.ts";

export class VoxelPatchBuilder {
  #cells: VoxelPatchCells = [];
  #partners: VoxelPatchPartners = [];

  get cellCount(): number {
    return this.#cells.length / VOXEL_PATCH_STRIDE;
  }

  push(
    position: Vector3Like,
    packed: PackedVoxel,
    partner: PackedVoxel = VOXEL_ABSENT
  ): this {
    const cell = this.cellCount;
    if (packed === VOXEL_ABSENT) {
      this.#cells.push(
        position.x,
        position.y,
        position.z,
        AIR_BLOCK_ID,
        0
      );

      return this;
    }

    this.#cells.push(
      position.x,
      position.y,
      position.z,
      voxelBlockId(packed),
      voxelTransform(packed)
    );
    if (partner !== VOXEL_ABSENT) {
      this.#partners.push(
        cell,
        voxelBlockId(partner),
        voxelTransform(partner)
      );
    }

    return this;
  }

  toPatch(): VoxelPatch {
    return voxelPatch(
      this.#cells,
      this.#partners
    );
  }
}

export function voxelPatchesRestoring(
  changes: readonly VoxelCellChange[],
  side: "before" | "after"
): Map<string, VoxelPatch> {
  const ordered = side === "before" ? changes.toReversed() : changes;
  const builders = new Map<string, VoxelPatchBuilder>();
  for (const change of ordered) {
    let builder = builders.get(change.layerId);
    if (builder === undefined) {
      builder = new VoxelPatchBuilder();
      builders.set(change.layerId, builder);
    }
    if (side === "before") {
      builder.push(change.position, change.before, change.beforePartner);
    }
    else {
      builder.push(change.position, change.after, change.afterPartner);
    }
  }

  return new Map(
    Array.from(builders, ([layerId, builder]) => [layerId, builder.toPatch()])
  );
}
