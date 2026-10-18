// Import Third-party Dependencies
import type {
  CommandHistory,
  OpenStep
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type { EditContext } from "../state/EditContext.ts";
import {
  editScope,
  type MapHistoryScope
} from "./mapHistory.ts";

export class MapSteps {
  readonly #history: Pick<CommandHistory<MapHistoryScope>, "open">;
  readonly #context: Pick<EditContext, "draft">;

  constructor(
    history: Pick<CommandHistory<MapHistoryScope>, "open">,
    context: Pick<EditContext, "draft">
  ) {
    this.#history = history;
    this.#context = context;
  }

  open(
    label: string
  ): OpenStep {
    return this.#history.open(editScope(this.#context.draft), label);
  }
}
