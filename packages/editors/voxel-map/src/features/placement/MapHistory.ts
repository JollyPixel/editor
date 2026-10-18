// Import Third-party Dependencies
import type {
  CommandHistory,
  HistoryScopeState
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type { MapPlacement } from "./MapPlacement.ts";
import {
  editScope,
  type MapHistoryScope
} from "../../shared/mapHistory.ts";
import type { MapAccessSource } from "../../access/MapAccess.ts";
import type { EditContext } from "../../state/index.ts";

export interface MapHistoryOptions {
  history: CommandHistory<MapHistoryScope>;
  placement: Pick<MapPlacement, "cancelLift">;
  access: MapAccessSource;
  context: Pick<EditContext, "draft" | "subscribe">;
}

export class MapHistory {
  readonly #history: CommandHistory<MapHistoryScope>;
  readonly #placement: Pick<MapPlacement, "cancelLift">;
  readonly #access: MapAccessSource;
  readonly #context: Pick<EditContext, "draft" | "subscribe">;

  constructor(
    options: MapHistoryOptions
  ) {
    this.#history = options.history;
    this.#placement = options.placement;
    this.#access = options.access;
    this.#context = options.context;
  }

  get state(): HistoryScopeState {
    return this.#history.state(this.#scope);
  }

  undo(): boolean {
    if (this.#access.current.readOnly) {
      return false;
    }

    return this.#placement.cancelLift() || this.#history.undo(this.#scope);
  }

  redo(): boolean {
    if (this.#access.current.readOnly) {
      return false;
    }

    this.#placement.cancelLift();

    return this.#history.redo(this.#scope);
  }

  subscribe(
    event: "change",
    listener: (state: HistoryScopeState) => void
  ): () => void {
    const unsubscribers = [
      this.#history.subscribe(
        event,
        (scope, state) => {
          if (scope === this.#scope) {
            listener(state);
          }
        }
      ),
      this.#context.subscribe("change", () => listener(this.state))
    ];

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }

  get #scope(): MapHistoryScope {
    return editScope(this.#context.draft);
  }
}
