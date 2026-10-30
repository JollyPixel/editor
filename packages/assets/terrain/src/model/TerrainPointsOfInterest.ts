// Import Third-party Dependencies
import { InvalidEntryError } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import type {
  PointOfInterestChanges,
  PointOfInterestData,
  PointOfInterestProperties
} from "../network/types.ts";
import { changedPoiFields } from "./poiCommands.ts";

// CONSTANTS
export const DEFAULT_POI_PROPERTIES: Readonly<PointOfInterestProperties> = Object.freeze({
  name: "Point of interest",
  lodBias: 2,
  minLevel: 3,
  priority: 0,
  chunks: []
});

export interface TerrainPointsOfInterestReader {
  readonly size: number;

  pointOfInterest(id: string): PointOfInterestData | undefined;
  pointsOfInterest(): PointOfInterestData[];
}

export class TerrainPointsOfInterest implements TerrainPointsOfInterestReader {
  #points = new Map<string, PointOfInterestData>();

  get size(): number {
    return this.#points.size;
  }

  pointOfInterest(
    id: string
  ): PointOfInterestData | undefined {
    const point = this.#points.get(id);

    return point === undefined ? undefined : copyPointOfInterest(point);
  }

  pointsOfInterest(): PointOfInterestData[] {
    return Array.from(this.#points.values(), copyPointOfInterest);
  }

  add(
    point: PointOfInterestData
  ): void {
    if (this.#points.has(point.id)) {
      throw new InvalidEntryError("point of interest", point.id, "is listed twice");
    }
    this.#points.set(point.id, copyPointOfInterest(point));
  }

  update(
    id: string,
    changes: PointOfInterestChanges
  ): void {
    const point = this.#points.get(id);
    if (point === undefined) {
      throw new RangeError(`Terrain has no point of interest "${id}".`);
    }

    const updated = { ...point };
    for (const field of changedPoiFields(changes)) {
      Object.assign(updated, { [field]: changes[field] });
    }
    this.#points.set(id, copyPointOfInterest(updated));
  }

  remove(
    id: string
  ): void {
    this.#points.delete(id);
  }

  clear(): void {
    this.#points.clear();
  }

  load(
    points: Iterable<PointOfInterestData>
  ): void {
    this.clear();
    for (const point of points) {
      this.add(point);
    }
  }
}

export function copyPointOfInterest(
  point: PointOfInterestData
): PointOfInterestData {
  return {
    ...point,
    chunks: point.chunks.map(({ x, z }) => {
      return { x, z };
    })
  };
}
