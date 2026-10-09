// Import Third-party Dependencies
import {
  CommandHistory,
  type HistoryScopeState
} from "@jolly-pixel/history";
import {
  PixelDocument,
  type PixelDocumentOptions
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { pixelHistoryRegistration } from "#src/history/pixelHistoryRegistration.ts";

// CONSTANTS
const kScope = "pixels";

export class HistoryDocument extends PixelDocument {
  readonly history: CommandHistory<typeof kScope>;

  constructor(
    options: PixelDocumentOptions
  ) {
    super(options);
    this.history = new CommandHistory<typeof kScope>();
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
}
