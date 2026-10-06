// Import Third-party Dependencies
import type { VoxelHistory } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapPlacement } from "./MapPlacement.ts";

export interface MapHistoryOptions {
  history: Pick<VoxelHistory, "undo" | "redo">;
  placement: Pick<MapPlacement, "cancelLift">;
}

export class MapHistory {
  readonly #history: Pick<VoxelHistory, "undo" | "redo">;
  readonly #placement: Pick<MapPlacement, "cancelLift">;

  constructor(
    options: MapHistoryOptions
  ) {
    this.#history = options.history;
    this.#placement = options.placement;
  }

  undo(): boolean {
    return this.#placement.cancelLift() || this.#history.undo();
  }

  redo(): boolean {
    this.#placement.cancelLift();

    return this.#history.redo();
  }
}
