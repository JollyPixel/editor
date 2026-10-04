// Import Internal Dependencies
import type { UVMap } from "../uv/map/UVMap.ts";
import {
  UVRegion,
  type UVSlot,
  type UVRegionData
} from "../uv/region/UVRegion.ts";
import type { SelectionRect } from "../types.ts";
import type { IndexedNormalMapZone } from "../normal/types.ts";
import type { HistoryEdit } from "../history/HistoryEntry.ts";
import type {
  DocumentCommand,
  PixelCommand,
  UVRegionRotation
} from "./PixelCommand.ts";

export type UVRegionFilter = (id: string) => boolean;

export interface UVOwnershipOptions {
  uv: UVMap;
  isRecording: () => boolean;
  removeNormalMapZoneOf: (regionId: string) => IndexedNormalMapZone | null;
  record: (edit: HistoryEdit) => void;
}

export class UVOwnership {
  #disowned = new Set<UVRegionFilter>();
  #isRecording: () => boolean;
  #removeNormalMapZoneOf: (regionId: string) => IndexedNormalMapZone | null;
  #record: (edit: HistoryEdit) => void;

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
      redo: [created(region.toJSON())],
      undo: [deleted(region.id)]
    });
  }

  #deleted(
    region: UVRegion
  ): void {
    if (!this.#tracks(region.id)) {
      return;
    }

    const zone = this.#removeNormalMapZoneOf(region.id);
    const undo = [created(region.toJSON())];
    if (zone) {
      undo.push({
        action: "normal-map-zone-set",
        metadata: zone
      });
    }

    this.#record({
      redo: [deleted(region.id)],
      undo
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
      redo: [moved(region.id, face, region.rectFor(face ?? "front"))],
      undo: [moved(region.id, face, previousRect)]
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
      redo: [stateChanged(region.toJSON())],
      undo: [stateChanged(previous)]
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
      redo: [rotated(region, face)],
      undo: [rotated(UVRegion.from(previous), face)]
    });
  }
}

function created(
  region: UVRegionData
): DocumentCommand {
  return {
    action: "uv-region-created",
    metadata: { region }
  };
}

function deleted(
  id: string
): DocumentCommand {
  return {
    action: "uv-region-deleted",
    metadata: { id }
  };
}

function moved(
  id: string,
  face: UVSlot | null,
  rect: SelectionRect
): DocumentCommand {
  return {
    action: "uv-region-moved",
    metadata: {
      id,
      face,
      rect
    }
  };
}

function stateChanged(
  region: UVRegionData
): DocumentCommand {
  return {
    action: "uv-region-state-changed",
    metadata: { region }
  };
}

function rotated(
  region: UVRegion,
  face: UVSlot | null
): DocumentCommand {
  const rotation: UVRegionRotation = face === null ?
    {
      id: region.id,
      face,
      region: region.toJSON()
    } :
    {
      id: region.id,
      face,
      geometry: region.geometryFor(face)
    };

  return {
    action: "uv-region-rotated",
    metadata: rotation
  };
}
