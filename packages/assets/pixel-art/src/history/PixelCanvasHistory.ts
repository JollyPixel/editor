// Import Third-party Dependencies
import {
  ChangeSourceAdapter,
  CommandHistory,
  KeyedGuard
} from "@jolly-pixel/history";
import type {
  PixelArtCanvasHistory,
  PixelDocument,
  PixelHistoryBinding,
  PixelHistoryState,
  PixelHistoryTarget
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { registerPixelHistory } from "./pixelHistoryRegistration.ts";

// CONSTANTS
const kStandaloneScope = "pixels";
const kDefaultLimit = 10;
const kStandaloneHistories = new WeakMap<
  PixelDocument,
  SharedPixelHistory<typeof kStandaloneScope>
>();

export class SharedPixelHistory<TScope extends string>
implements PixelArtCanvasHistory {
  static #selections = 0;

  readonly history: CommandHistory<TScope>;
  readonly scope: TScope;

  constructor(
    history: CommandHistory<TScope>,
    scope: TScope
  ) {
    this.history = history;
    this.scope = scope;
  }

  bind(
    target: PixelHistoryTarget,
    onChange: (state: PixelHistoryState) => void
  ): PixelHistoryBinding {
    const { history, scope } = this;
    const selection = new ChangeSourceAdapter(target.selection);
    function listener(
      changed: TScope
    ): void {
      if (changed === scope) {
        onChange(history.state(scope));
      }
    }
    history.on("change", listener);
    const unregister = history.register({
      id: `selection:${SharedPixelHistory.#selections++}`,
      document: selection,
      keys: {
        written: () => [],
        guard: () => new KeyedGuard([])
      },
      scopeOf: () => scope
    });

    return {
      get state() {
        return history.state(scope);
      },
      undo: () => history.undo(scope),
      redo: () => history.redo(scope),
      record: (edit) => history.record(scope, null, edit),
      release: () => {
        history.off("change", listener);
        unregister();
        selection.dispose();
      }
    };
  }
}

export interface StandalonePixelHistoryOptions {
  /**
   * @default 10
   */
  limit?: number;
}

export class StandalonePixelHistory implements PixelArtCanvasHistory {
  #limit: number;

  constructor(
    options: StandalonePixelHistoryOptions = {}
  ) {
    this.#limit = options.limit ?? kDefaultLimit;
  }

  bind(
    target: PixelHistoryTarget,
    onChange: (state: PixelHistoryState) => void
  ): PixelHistoryBinding {
    let shared = kStandaloneHistories.get(target.document);
    if (shared === undefined) {
      const history = new CommandHistory({
        scopes: [kStandaloneScope],
        limit: this.#limit
      });
      registerPixelHistory(history, target.document, { scope: kStandaloneScope });
      shared = new SharedPixelHistory(history, kStandaloneScope);
      kStandaloneHistories.set(target.document, shared);
    }

    return shared.bind(target, onChange);
  }
}
