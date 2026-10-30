// Import Third-party Dependencies
import type { TerrainDocument } from "@jolly-pixel/asset.terrain/client";
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
import { ChunkPathDrag } from "./ChunkPathDrag.ts";

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

export class ChunkDrag extends ChunkPathDrag {
  readonly mode: ChunkMode;

  #options: ChunkDragOptions;
  #tier: ChunkTier;

  constructor(
    options: ChunkDragOptions,
    { mode, tier }: ChunkDragAction,
    point: GroundPoint
  ) {
    super(options.history.open(TERRAIN_HISTORY_SCOPE, kLabels[mode]), point);
    this.mode = mode;
    this.#tier = tier;
    this.#options = options;
    this.moveTo(point);
  }

  protected override visit(
    coords: readonly ChunkCoord[]
  ): void {
    for (const coord of coords) {
      this.#apply(coord);
    }
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
