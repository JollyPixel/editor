// Import Internal Dependencies
import {
  MAX_POINTS_OF_INTEREST,
  poiPropertiesSchema,
  TERRAIN_POI_ACTIONS
} from "../network/TerrainCommand.schema.ts";
import type {
  PointOfInterestChanges,
  PointOfInterestField,
  TerrainCommand,
  TerrainPoiCommand
} from "../network/types.ts";
import type { TerrainImage } from "./TerrainDocument.ts";
import type {
  TerrainPointsOfInterest,
  TerrainPointsOfInterestReader
} from "./TerrainPointsOfInterest.ts";

// CONSTANTS
export const POI_FIELDS = Object.freeze(
  Object.keys(poiPropertiesSchema.def.shape) as PointOfInterestField[]
);
const kPoiActions = new Set<string>(TERRAIN_POI_ACTIONS);

export interface PoiWriteRef {
  readonly kind: "poi";
  readonly id: string;
  readonly field: PointOfInterestField | null;
}

export function isPoiCommand(
  command: TerrainCommand
): command is TerrainPoiCommand {
  return kPoiActions.has(command.action);
}

export function changedPoiFields(
  changes: PointOfInterestChanges
): PointOfInterestField[] {
  return POI_FIELDS.filter((field) => changes[field] !== undefined);
}

export function acceptsPoiCommand(
  points: TerrainPointsOfInterestReader,
  command: TerrainPoiCommand
): boolean {
  switch (command.action) {
    case "poi-added":
      return points.pointOfInterest(command.poi.id) === undefined &&
        points.size < MAX_POINTS_OF_INTEREST &&
        hasUniqueChunks(command.poi.chunks);
    case "poi-updated":
      return points.pointOfInterest(command.id) !== undefined &&
        changedPoiFields(command.changes).length > 0 &&
        (command.changes.chunks === undefined || hasUniqueChunks(command.changes.chunks));
    case "poi-removed":
      return points.pointOfInterest(command.id) !== undefined;
  }
}

export function applyPoiCommand(
  points: TerrainPointsOfInterest,
  command: TerrainPoiCommand
): void {
  switch (command.action) {
    case "poi-added":
      points.add(command.poi);
      break;
    case "poi-updated":
      points.update(command.id, command.changes);
      break;
    case "poi-removed":
      points.remove(command.id);
      break;
  }
}

export function invertPoiCommand(
  points: TerrainPointsOfInterestReader,
  command: TerrainPoiCommand
): TerrainCommand[] {
  switch (command.action) {
    case "poi-added":
      return [{ action: "poi-removed", id: command.poi.id }];
    case "poi-updated": {
      const point = points.pointOfInterest(command.id);
      if (point === undefined) {
        return [];
      }

      const changes: PointOfInterestChanges = {};
      for (const field of changedPoiFields(command.changes)) {
        Object.assign(changes, { [field]: point[field] });
      }

      return [{ action: "poi-updated", id: command.id, changes }];
    }
    case "poi-removed": {
      const point = points.pointOfInterest(command.id);

      return point === undefined ? [] : [{ action: "poi-added", poi: point }];
    }
  }
}

export function capturePoiImage(
  points: TerrainPointsOfInterestReader,
  command: TerrainPoiCommand
): TerrainImage {
  const id = poiCommandId(command);

  return {
    chunks: [],
    materials: [],
    textureSize: null,
    pointsOfInterest: [{ id, poi: points.pointOfInterest(id) ?? null }]
  };
}

export function poiWriteRefs(
  command: TerrainPoiCommand
): PoiWriteRef[] {
  if (command.action === "poi-updated") {
    return changedPoiFields(command.changes).map((field) => {
      return { kind: "poi", id: command.id, field };
    });
  }

  const id = poiCommandId(command);

  return [null, ...POI_FIELDS].map((field) => {
    return { kind: "poi", id, field };
  });
}

function poiCommandId(
  command: TerrainPoiCommand
): string {
  return command.action === "poi-added" ? command.poi.id : command.id;
}

function hasUniqueChunks(
  chunks: readonly { readonly x: number; readonly z: number; }[]
): boolean {
  return new Set(chunks.map(({ x, z }) => `${x},${z}`)).size === chunks.length;
}
