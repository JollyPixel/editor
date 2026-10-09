// Import Third-party Dependencies
import {
  CommandHistory,
  type HistoryScopeState
} from "@jolly-pixel/history";

// Import Internal Dependencies
import {
  PixelDocument,
  type PixelDocumentOptions
} from "#src/PixelDocument.ts";
import {
  unguardedRegistration,
  type LocalScope
} from "../history/LocalHistory.ts";

// CONSTANTS
const kScope = "pixels";

export class HistoryDocument extends PixelDocument {
  readonly history: CommandHistory<LocalScope>;

  constructor(
    options: PixelDocumentOptions,
    limit = 50
  ) {
    super(options);
    this.history = new CommandHistory({ limit });
    this.history.register(unguardedRegistration("pixels", this));
  }

  get state(): HistoryScopeState {
    return this.history.state(kScope);
  }

  get canUndo(): boolean {
    return this.state.canUndo;
  }

  undo(): boolean {
    return this.history.undo(kScope);
  }

  redo(): boolean {
    return this.history.redo(kScope);
  }
}
