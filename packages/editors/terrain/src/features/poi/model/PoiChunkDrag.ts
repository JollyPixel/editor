// Import Third-party Dependencies
import type { TerrainDocument } from "@jolly-pixel/asset.terrain/client";
import type { OpenStep } from "@jolly-pixel/history";

// Import Internal Dependencies
import {
  TERRAIN_HISTORY_SCOPE,
  type TerrainHistory
} from "../../../shared/terrainHistory.ts";
import { chunksAlong } from "../../chunks/model/chunksAlong.ts";
import type { GroundPoint } from "../../brush/model/StampSpacer.ts";

export type PoiChunkMode = "add" | "remove";

export interface PoiChunkDragOptions {
  document: Pick<TerrainDocument, "terrain" | "pointsOfInterest" | "updatePointOfInterest">;
  history: Pick<TerrainHistory, "open">;
}

export class PoiChunkDrag {
  readonly mode: PoiChunkMode;

  #options: PoiChunkDragOptions;
  #id: string;
  #step: OpenStep;
  #last: GroundPoint;
  #ended = false;

  constructor(
    options: PoiChunkDragOptions,
    { id, mode }: { id: string; mode: PoiChunkMode; },
    point: GroundPoint
  ) {
    this.mode = mode;
    this.#options = options;
    this.#id = id;
    this.#step = options.history.open(TERRAIN_HISTORY_SCOPE, "Edit point-of-interest chunks");
    this.#last = point;
    this.moveTo(point);
  }

  moveTo(
    point: GroundPoint
  ): void {
    if (this.#ended) {
      return;
    }

    const { document } = this.#options;
    const current = document.pointsOfInterest.pointOfInterest(this.#id);
    if (current === undefined) {
      return;
    }

    const chunks = new Map(current.chunks.map((chunk) => [`${chunk.x},${chunk.z}`, chunk]));
    for (const coord of chunksAlong(this.#last, point)) {
      if (this.mode === "remove") {
        chunks.delete(coord.key);
      }
      else if (document.terrain.knows(coord)) {
        chunks.set(coord.key, { x: coord.x, z: coord.z });
      }
    }
    this.#last = point;
    if (chunks.size !== current.chunks.length) {
      document.updatePointOfInterest(this.#id, { chunks: [...chunks.values()] });
    }
  }

  end(): void {
    if (this.#ended) {
      return;
    }

    this.#ended = true;
    this.#step.commit();
  }
}
