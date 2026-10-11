// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type {
  HistoryScopeState,
  HistoryStepInfo
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type { TabStore } from "../../state/index.ts";
import { combineReleases } from "../../shared/combineReleases.ts";
import {
  isTabHistoryScope,
  type EditorHistory,
  type EditorHistoryScope
} from "./editorHistory.ts";
import type { ModelAccessSignals } from "../../access/ModelAccess.ts";

export type ActiveHistoryEvents = {
  change: (state: HistoryScopeState) => void;
  skipped: (step: HistoryStepInfo) => void;
};

export interface HistoryFocus {
  scope: EditorHistoryScope;
  /**
   * What the scope edits, `null` when the tab says it.
   */
  name: string | null;
}

export interface FocusedHistory {
  readonly focused: HistoryFocus;
  subscribeFocus(listener: () => void): () => void;
}

export interface ActiveHistoryOptions {
  history: Pick<EditorHistory, "undo" | "redo" | "state" | "subscribe">;
  tab: Pick<TabStore, "active" | "subscribe">;
  animate: FocusedHistory;
  access: ModelAccessSignals;
}

export class ActiveHistory extends Emitter<ActiveHistoryEvents> {
  #options: ActiveHistoryOptions;
  #focus: HistoryFocus;
  #release: () => void;

  constructor(
    options: ActiveHistoryOptions
  ) {
    super();
    this.#options = options;
    const { history, tab, animate, access } = options;
    this.#focus = this.#focused();
    this.#release = combineReleases([
      access.subscribe("change", () => this.emit("change", this.state)),
      history.subscribe("change", this.#onChange),
      history.subscribe("skipped", this.#onSkipped),
      tab.subscribe("change", this.#refocus),
      animate.subscribeFocus(this.#refocus)
    ]);
  }

  get state(): HistoryScopeState {
    return this.#options.history.state(this.#focus.scope);
  }

  get targetName(): string | null {
    return this.#focus.name;
  }

  get readOnly(): boolean {
    return this.#options.access.current.readOnly;
  }

  undo(): boolean {
    return !this.readOnly && this.#options.history.undo(this.#focus.scope);
  }

  redo(): boolean {
    return !this.readOnly && this.#options.history.redo(this.#focus.scope);
  }

  dispose(): void {
    this.#release();
    this.removeAllListeners();
  }

  #focused(): HistoryFocus {
    const { tab, animate } = this.#options;
    const { active } = tab;

    return isTabHistoryScope(active) ?
      {
        scope: active,
        name: null
      } :
      animate.focused;
  }

  readonly #refocus = (): void => {
    const focus = this.#focused();
    if (focus.scope !== this.#focus.scope || focus.name !== this.#focus.name) {
      this.#focus = focus;
      this.emit("change", this.state);
    }
  };

  readonly #onChange = (
    scope: EditorHistoryScope
  ): void => {
    if (scope === this.#focus.scope) {
      this.emit("change", this.state);
    }
  };

  readonly #onSkipped = (
    scope: EditorHistoryScope,
    step: HistoryStepInfo
  ): void => {
    if (scope === this.#focus.scope) {
      this.emit("skipped", step);
    }
  };
}
