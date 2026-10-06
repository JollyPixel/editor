// Import Third-party Dependencies
import {
  VOXEL_ABSENT,
  VoxelPatchBuilder,
  VoxelTemplate,
  type VoxelCoord,
  type VoxelPatch,
  type VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  CellRegion,
  CellRegionJSON
} from "./CellRegion.ts";
import type { Placement } from "./Placement.ts";

// CONSTANTS
export const REGION_NAME = "Selection";

export interface RegionSourceRef {
  kind: "region";
  layerName: string;
  region: CellRegionJSON;
}

export class RegionSource {
  static capture(
    world: VoxelWorld,
    layerName: string,
    region: CellRegion
  ): RegionSource | null {
    const layer = world.getLayer(layerName);
    if (layer === undefined) {
      return null;
    }

    const anchored = VoxelTemplate.fromLayer(layer, {
      id: `region:${layerName}`,
      name: REGION_NAME,
      bounds: region,
      pivot: region.min
    });
    if (anchored.voxelCount === 0) {
      return null;
    }

    const { min, size } = anchored.placedBounds(region.min);
    const snapshot = anchored.withPatch({
      pivot: {
        x: Math.floor(size.x / 2),
        y: 0,
        z: Math.floor(size.z / 2)
      }
    });

    return new RegionSource(layerName, region, snapshot, {
      x: min.x + snapshot.pivot.x,
      y: min.y + snapshot.pivot.y,
      z: min.z + snapshot.pivot.z
    });
  }

  readonly kind = "region";
  readonly layerName: string;
  readonly region: CellRegion;
  readonly snapshot: VoxelTemplate;
  readonly pivot: Readonly<VoxelCoord>;

  constructor(
    layerName: string,
    region: CellRegion,
    snapshot: VoxelTemplate,
    pivot: VoxelCoord
  ) {
    this.layerName = layerName;
    this.region = region;
    this.snapshot = snapshot;
    this.pivot = Object.freeze({
      ...pivot
    });

    Object.freeze(this);
  }

  resolve(
    world: VoxelWorld
  ): VoxelTemplate | undefined {
    return world.getLayer(this.layerName) === undefined ?
      undefined :
      this.snapshot;
  }

  erasePatch(): VoxelPatch {
    const builder = new VoxelPatchBuilder();
    for (const [x, y, z] of this.snapshot.placedVoxels(this.pivot)) {
      builder.push({ x, y, z }, VOXEL_ABSENT);
    }

    return builder.toPatch();
  }

  restorePatch(): VoxelPatch {
    const builder = new VoxelPatchBuilder();
    for (const [x, y, z, packed, partner] of this.snapshot.placedVoxels(this.pivot)) {
      builder.push({ x, y, z }, packed, partner);
    }

    return builder.toPatch();
  }

  movePatch(
    placement: Placement
  ): VoxelPatch {
    const builder = new VoxelPatchBuilder();
    const covered = new Set<string>();
    const placed = this.snapshot.placedVoxels(
      placement.position,
      placement.transform
    );
    for (const [x, y, z, packed, partner] of placed) {
      builder.push({ x, y, z }, packed, partner);
      covered.add(`${x},${y},${z}`);
    }
    for (const [x, y, z] of this.snapshot.placedVoxels(this.pivot)) {
      if (!covered.has(`${x},${y},${z}`)) {
        builder.push({ x, y, z }, VOXEL_ABSENT);
      }
    }

    return builder.toPatch();
  }

  toRef(): RegionSourceRef {
    return {
      kind: this.kind,
      layerName: this.layerName,
      region: this.region.toJSON()
    };
  }
}
