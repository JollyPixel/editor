// Import Third-party Dependencies
import type { TerrainDocument } from "@jolly-pixel/asset.terrain/client";
import type { OpenStep } from "@jolly-pixel/history";
import type {
  ChunkCoord,
  ChunkTier
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  TERRAIN_HISTORY_SCOPE,
  type TerrainHistory
} from "../../../shared/terrainHistory.ts";
import type { GroundPoint } from "../../brush/model/StampSpacer.ts";
import { chunksAlong } from "./chunksAlong.ts";

// CONSTANTS
const kLabels: Readonly<Record<ChunkMode, string>> = {
  add: "Add chunks",
  remove: "Remove chunks",
  detail: "Change detail"
};

export const CHUNK_MODES = ["add", "remove", "detail"] as const;

export type ChunkMode = typeof CHUNK_MODES[number];

export interface ChunkDragOptions {
  document: Pick<TerrainDocument, "terrain" | "addChunk" | "removeChunk" | "changeTier">;
  history: Pick<TerrainHistory, "open">;
}

export interface ChunkDragAction {
  readonly mode: ChunkMode;
  readonly tier: ChunkTier;
}

export class ChunkDrag {
  readonly mode: ChunkMode;

  #options: ChunkDragOptions;
  #tier: ChunkTier;
  #step: OpenStep;
  #last: GroundPoint;
  #ended = false;

  constructor(
    options: ChunkDragOptions,
    { mode, tier }: ChunkDragAction,
    point: GroundPoint
  ) {
    this.mode = mode;
    this.#tier = tier;
    this.#options = options;
    this.#step = options.history.open(TERRAIN_HISTORY_SCOPE, kLabels[mode]);
    this.#last = point;
    this.moveTo(point);
  }

  moveTo(
    point: GroundPoint
  ): void {
    if (this.#ended) {
      return;
    }

    for (const coord of chunksAlong(this.#last, point)) {
      this.#apply(coord);
    }
    this.#last = point;
  }

  end(): void {
    if (this.#ended) {
      return;
    }

    this.#ended = true;
    this.#step.commit();
  }

  #apply(
    coord: ChunkCoord
  ): void {
    const { document } = this.#options;
    if (this.mode === "add") {
      document.addChunk(coord.x, coord.z);
    }
    else if (this.mode === "detail") {
      document.changeTier(coord.x, coord.z, this.#tier);
    }
    else if (document.terrain.has(coord)) {
      document.removeChunk(coord.x, coord.z);
    }
  }
}
