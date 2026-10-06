// Import Third-party Dependencies
import {
  VoxelPatchBuilder,
  type VoxelPatch,
  type VoxelTemplate
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { Placement } from "./Placement.ts";

export interface CopySourceRef {
  kind: "copy";
  copyId: string;
}

export class CopySource {
  static of(
    snapshot: VoxelTemplate
  ): CopySource {
    return new CopySource(crypto.randomUUID(), snapshot);
  }

  readonly kind = "copy";
  readonly id: string;
  readonly snapshot: VoxelTemplate;

  constructor(
    id: string,
    snapshot: VoxelTemplate
  ) {
    this.id = id;
    this.snapshot = snapshot;

    Object.freeze(this);
  }

  resolve(): VoxelTemplate {
    return this.snapshot;
  }

  placePatch(
    placement: Pick<Placement, "position" | "transform">
  ): VoxelPatch {
    const builder = new VoxelPatchBuilder();
    const placed = this.snapshot.placedVoxels(
      placement.position,
      placement.transform
    );
    for (const [x, y, z, packed, partner] of placed) {
      builder.push({ x, y, z }, packed, partner);
    }

    return builder.toPatch();
  }

  toRef(): CopySourceRef {
    return {
      kind: this.kind,
      copyId: this.id
    };
  }
}
