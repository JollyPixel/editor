// Import Third-party Dependencies
import type { TerrainDocument } from "@jolly-pixel/asset.terrain/client";
import type { ChunkCoord } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  TERRAIN_HISTORY_SCOPE,
  type TerrainHistory
} from "../../../shared/terrainHistory.ts";
import { ChunkPathDrag } from "../../chunks/model/ChunkPathDrag.ts";
import type { GroundPoint } from "../../brush/model/StampSpacer.ts";

export type PoiChunkMode = "add" | "remove";

export interface PoiChunkDragOptions {
  document: Pick<TerrainDocument, "terrain" | "pointsOfInterest" | "updatePointOfInterest">;
  history: Pick<TerrainHistory, "open">;
}

export class PoiChunkDrag extends ChunkPathDrag {
  readonly mode: PoiChunkMode;

  #options: PoiChunkDragOptions;
  #id: string;

  constructor(
    options: PoiChunkDragOptions,
    { id, mode }: { id: string; mode: PoiChunkMode; },
    point: GroundPoint
  ) {
    super(options.history.open(TERRAIN_HISTORY_SCOPE, "Edit point-of-interest chunks"), point);
    this.mode = mode;
    this.#options = options;
    this.#id = id;
    this.moveTo(point);
  }

  protected override visit(
    coords: readonly ChunkCoord[]
  ): void {
    const { document } = this.#options;
    const current = document.pointsOfInterest.pointOfInterest(this.#id);
    if (current === undefined) {
      return;
    }

    const chunks = new Map(current.chunks.map((chunk) => [`${chunk.x},${chunk.z}`, chunk]));
    for (const coord of coords) {
      if (this.mode === "remove") {
        chunks.delete(coord.key);
      }
      else if (document.terrain.knows(coord)) {
        chunks.set(coord.key, { x: coord.x, z: coord.z });
      }
    }
    if (chunks.size !== current.chunks.length) {
      document.updatePointOfInterest(this.#id, { chunks: [...chunks.values()] });
    }
  }
}
