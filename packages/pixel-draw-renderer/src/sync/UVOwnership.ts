// Import Internal Dependencies
import type { UVMap } from "../uv/map/UVMap.ts";
import {
  UVRegion,
  type UVSlot,
  type UVRegionData
} from "../uv/region/UVRegion.ts";
import type { SelectionRect } from "../types.ts";
import type { IndexedNormalMapZone } from "../normal/types.ts";
import {
  uvRegionCreated,
  uvRegionDeleted,
  uvRegionMoved,
  uvRegionRotated,
  uvRegionStateChanged,
  type DocumentCommand,
  type PixelCommand
} from "./PixelCommand.ts";
import type { LocalEdit } from "./LocalEdit.types.ts";

export type UVRegionFilter = (id: string) => boolean;

export interface UVOwnershipOptions {
  uv: UVMap;
  isRecording: () => boolean;
  removeNormalMapZoneOf: (regionId: string) => IndexedNormalMapZone | null;
  record: (edit: LocalEdit) => void;
}

export class UVOwnership {
  #disowned = new Set<UVRegionFilter>();
  #isRecording: () => boolean;
  #removeNormalMapZoneOf: (regionId: string) => IndexedNormalMapZone | null;
  #record: (edit: LocalEdit) => void;

  constructor(
    options: UVOwnershipOptions
  ) {
    const { uv } = options;
    this.#isRecording = options.isRecording;
    this.#removeNormalMapZoneOf = options.removeNormalMapZoneOf;
    this.#record = options.record;

    uv.on("region-created", ({ region }) => this.#created(region));
    uv.on("region-deleted", ({ region }) => this.#deleted(region));
    uv.on("region-moved", ({ region, face, previousRect }) => this.#moved(region, face, previousRect));
    uv.on("region-state-changed", ({ region, previous }) => this.#stateChanged(region, previous));
    uv.on("region-rotated", ({ region, previous, face }) => this.#rotated(region, previous, face));
  }

  disown(
    filter: UVRegionFilter
  ): () => void {
    this.#disowned.add(filter);

    return () => {
      this.#disowned.delete(filter);
    };
  }

  owns(
    id: string
  ): boolean {
    for (const disowns of this.#disowned) {
      if (disowns(id)) {
        return false;
      }
    }

    return true;
  }

  admits(
    command: PixelCommand
  ): boolean {
    switch (command.action) {
      case "uv-region-created":
      case "uv-region-state-changed":
        return this.owns(command.metadata.region.id);
      case "uv-region-deleted":
      case "uv-region-moved":
      case "uv-region-rotated":
        return this.owns(command.metadata.id);
      default:
        return true;
    }
  }

  #tracks(
    regionId: string
  ): boolean {
    return this.#isRecording() && this.owns(regionId);
  }

  #created(
    region: UVRegion
  ): void {
    if (!this.#tracks(region.id)) {
      return;
    }

    this.#record({
      command: uvRegionCreated(region.toJSON()),
      inverse: [uvRegionDeleted(region.id)]
    });
  }

  #deleted(
    region: UVRegion
  ): void {
    if (!this.#tracks(region.id)) {
      return;
    }

    const zone = this.#removeNormalMapZoneOf(region.id);
    const inverse: DocumentCommand[] = [uvRegionCreated(region.toJSON())];
    if (zone) {
      inverse.push({
        action: "normal-map-zone-set",
        metadata: zone
      });
    }

    this.#record({
      command: uvRegionDeleted(region.id),
      inverse
    });
  }

  #moved(
    region: UVRegion,
    face: UVSlot | null,
    previousRect: SelectionRect
  ): void {
    if (!this.#tracks(region.id)) {
      return;
    }

    this.#record({
      command: uvRegionMoved(region.id, face, region.rectFor(face ?? "front")),
      inverse: [uvRegionMoved(region.id, face, previousRect)]
    });
  }

  #stateChanged(
    region: UVRegion,
    previous: UVRegionData
  ): void {
    if (!this.#tracks(region.id)) {
      return;
    }

    this.#record({
      command: uvRegionStateChanged(region.toJSON()),
      inverse: [uvRegionStateChanged(previous)]
    });
  }

  #rotated(
    region: UVRegion,
    previous: UVRegionData,
    face: UVSlot | null
  ): void {
    if (!this.#tracks(region.id)) {
      return;
    }

    this.#record({
      command: uvRegionRotated(region, face),
      inverse: [uvRegionRotated(UVRegion.from(previous), face)]
    });
  }
}
