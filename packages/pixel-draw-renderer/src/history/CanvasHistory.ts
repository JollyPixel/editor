// Import Third-party Dependencies
import {
  CommandHistory,
  type HistoryScopeState
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type { PixelDocument } from "../PixelDocument.ts";
import type {
  SelectionChange,
  SelectionFootprint
} from "../selection/SelectionFootprint.ts";
import { SelectionHistory } from "./SelectionHistory.ts";
import { registerPixelHistory } from "./pixelHistoryRegistration.ts";

// CONSTANTS
const kDefaultLimit = 10;
const kStandaloneScope = "pixels";
const kStandalone = new WeakMap<PixelDocument, CommandHistory<string>>();
const kEmptyState: HistoryScopeState = {
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
  undoCount: 0,
  redoCount: 0,
  refused: []
};

export interface PixelHistoryOwner<TScope extends string = string> {
  /**
   * A history the host registered the document in, with `registerPixelHistory`.
   */
  history: CommandHistory<TScope>;
  scope: TScope;
}

export interface StandalonePixelHistory {
  /**
   * @default false
   */
  enabled?: boolean;
  /**
   * @default 10
   */
  limit?: number;
}

export type PixelArtCanvasHistory = StandalonePixelHistory | PixelHistoryOwner;

export interface CanvasHistoryOptions {
  document: PixelDocument;
  history?: PixelArtCanvasHistory;
  restoreSelection: (footprint: SelectionFootprint) => void;
  onChange?: (state: HistoryScopeState) => void;
}

export class CanvasHistory {
  static #selections = 0;

  readonly history: CommandHistory<string> | null;
  readonly scope: string;

  #selection = new SelectionHistory();
  #releases: (() => void)[] = [];

  constructor(
    options: CanvasHistoryOptions
  ) {
    const owner = ownerOf(options.document, options.history ?? {});
    this.history = owner?.history ?? null;
    this.scope = owner?.scope ?? kStandaloneScope;
    if (owner === null) {
      return;
    }

    const { history, scope } = owner;
    const onChange = (changed: string, state: HistoryScopeState): void => {
      if (changed !== scope) {
        return;
      }

      const restored = this.#selection.takeRestored();
      if (restored !== null) {
        options.restoreSelection(restored);
      }
      options.onChange?.(state);
    };
    history.on("change", onChange);
    this.#releases.push(
      () => history.off("change", onChange),
      history.register(
        this.#selection.registration(
          `selection:${CanvasHistory.#selections++}`,
          scope
        )
      )
    );
  }

  get state(): HistoryScopeState {
    return this.history?.state(this.scope) ?? kEmptyState;
  }

  undo(): boolean {
    return this.history?.undo(this.scope) ?? false;
  }

  redo(): boolean {
    return this.history?.redo(this.scope) ?? false;
  }

  recordSelectionEdit(
    change: SelectionChange,
    edit: () => void
  ): void {
    if (this.history === null) {
      edit();

      return;
    }

    this.history.record(this.scope, null, () => {
      this.#selection.record(change);
      edit();
    });
  }

  destroy(): void {
    for (const release of this.#releases.splice(0)) {
      release();
    }
  }
}

function ownerOf(
  document: PixelDocument,
  history: PixelArtCanvasHistory
): PixelHistoryOwner | null {
  if ("history" in history) {
    return history;
  }
  if (history.enabled !== true) {
    return null;
  }

  return {
    history: standaloneHistoryOf(
      document,
      history.limit ?? kDefaultLimit
    ),
    scope: kStandaloneScope
  };
}

function standaloneHistoryOf(
  document: PixelDocument,
  limit: number
): CommandHistory<string> {
  let history = kStandalone.get(document);
  if (history === undefined) {
    history = new CommandHistory({
      scopes: [kStandaloneScope],
      limit
    });
    registerPixelHistory(
      history,
      document,
      { scope: kStandaloneScope }
    );
    kStandalone.set(document, history);
  }

  return history;
}
