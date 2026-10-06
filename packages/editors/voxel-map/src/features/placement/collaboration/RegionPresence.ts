// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  CellRegion,
  isCellCoord,
  sameCellCoord,
  type CellRegionJSON
} from "../CellRegion.ts";
import {
  REGION_NAME,
  RegionSource,
  type RegionSourceRef
} from "../RegionSource.ts";
import {
  PresenceSnapshot,
  type PresenceSnapshotJSON
} from "./PresenceSnapshot.ts";

export interface RegionPresenceJSON extends PresenceSnapshotJSON {
  layerName: string;
  region: CellRegionJSON;
  origin: VoxelCoord;
}

export class RegionPresence {
  static parse(
    value: unknown
  ): RegionPresence | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }

    const layerName = Reflect.get(value, "layerName");
    const region = CellRegion.parse(Reflect.get(value, "region"));
    const origin = Reflect.get(value, "origin");
    const snapshot = PresenceSnapshot.parse(value);
    if (
      typeof layerName !== "string" ||
      layerName.length === 0 ||
      region === null ||
      !isCellCoord(origin) ||
      snapshot === null
    ) {
      return null;
    }

    return new RegionPresence(
      new RegionSource(
        layerName,
        region,
        snapshot.toTemplate(`region:${layerName}`, REGION_NAME),
        origin
      )
    );
  }

  readonly source: RegionSource;

  constructor(
    source: RegionSource
  ) {
    this.source = source;

    Object.freeze(this);
  }

  describes(
    ref: RegionSourceRef
  ): boolean {
    return ref.layerName === this.source.layerName &&
      this.source.region.equals(ref.region);
  }

  equals(
    other: RegionPresence | null
  ): boolean {
    if (other === null) {
      return false;
    }
    if (other.source === this.source) {
      return true;
    }

    const { source } = this;

    return source.layerName === other.source.layerName &&
      source.region.equals(other.source.region) &&
      sameCellCoord(source.pivot, other.source.pivot) &&
      PresenceSnapshot.of(source.snapshot).equals(
        PresenceSnapshot.of(other.source.snapshot)
      );
  }

  toJSON(): RegionPresenceJSON {
    const { layerName, region, snapshot, pivot } = this.source;

    return {
      layerName,
      region: region.toJSON(),
      origin: { ...pivot },
      ...PresenceSnapshot.of(snapshot).toJSON()
    };
  }
}
