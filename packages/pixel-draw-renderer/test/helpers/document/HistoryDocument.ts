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
import { pixelHistoryRegistration } from "#src/history/pixelHistoryRegistration.ts";

// CONSTANTS
const kScope = "pixels";

export class HistoryDocument extends PixelDocument {
  readonly history: CommandHistory<typeof kScope>;

  constructor(
    options: PixelDocumentOptions,
    limit = 50
  ) {
    super(options);
    this.history = new CommandHistory({
      scopes: [kScope],
      limit
    });
    this.history.register(pixelHistoryRegistration(this, { scope: kScope }));
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
