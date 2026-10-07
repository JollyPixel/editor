// Import Third-party Dependencies
import type {
  CommandHistory,
  HistoryScopeState
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type { MapPlacement } from "./MapPlacement.ts";
import {
  MAP_HISTORY_SCOPE,
  type MapHistoryScope
} from "../../shared/mapHistory.ts";

export interface MapHistoryOptions {
  history: CommandHistory<MapHistoryScope>;
  placement: Pick<MapPlacement, "cancelLift">;
}

export class MapHistory {
  readonly #history: CommandHistory<MapHistoryScope>;
  readonly #placement: Pick<MapPlacement, "cancelLift">;

  constructor(
    options: MapHistoryOptions
  ) {
    this.#history = options.history;
    this.#placement = options.placement;
  }

  get state(): HistoryScopeState {
    return this.#history.state(MAP_HISTORY_SCOPE);
  }

  undo(): boolean {
    return this.#placement.cancelLift() || this.#history.undo(MAP_HISTORY_SCOPE);
  }

  redo(): boolean {
    this.#placement.cancelLift();

    return this.#history.redo(MAP_HISTORY_SCOPE);
  }

  subscribe(
    event: "change",
    listener: (state: HistoryScopeState) => void
  ): () => void {
    return this.#history.subscribe(
      event,
      (_scope, state) => listener(state)
    );
  }
}
