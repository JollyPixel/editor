// Import Third-party Dependencies
import {
  ChangeSourceAdapter,
  CommandHistory,
  KeyedGuard,
  type ChangeSource,
  type HistoryRegistration
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type { PixelDocument } from "#src/PixelDocument.ts";
import type {
  PixelArtCanvasHistory,
  PixelHistoryBinding,
  PixelHistoryState,
  PixelHistoryTarget
} from "#src/history/CanvasHistory.ts";

// CONSTANTS
const kScope = "pixels";

export type LocalScope = typeof kScope;

export interface LocalHistoryOptions {
  limit?: number;
}

export function unguardedRegistration<TCommand>(
  id: string,
  source: ChangeSource<TCommand>
): HistoryRegistration<LocalScope, TCommand, null> & {
  document: ChangeSourceAdapter<TCommand>;
} {
  return {
    id,
    document: new ChangeSourceAdapter(source),
    keys: {
      written: () => [],
      guard: () => new KeyedGuard([])
    },
    scopeOf: () => kScope
  };
}

export function localPixelHistory(
  document: PixelDocument,
  limit = 10
): CommandHistory<LocalScope> {
  const history = new CommandHistory<LocalScope>({ limit });
  history.register(unguardedRegistration("pixels", document));
  document.groupEditsWith((edit) => history.record(kScope, null, edit));

  return history;
}

export class LocalHistory implements PixelArtCanvasHistory {
  #limit: number;
  #histories = new WeakMap<PixelDocument, CommandHistory<LocalScope>>();
  #selections = 0;

  constructor(
    options: LocalHistoryOptions = {}
  ) {
    this.#limit = options.limit ?? 10;
  }

  bind(
    target: PixelHistoryTarget,
    onChange: (state: PixelHistoryState) => void
  ): PixelHistoryBinding {
    let history = this.#histories.get(target.document);
    if (history === undefined) {
      history = localPixelHistory(target.document, this.#limit);
      this.#histories.set(target.document, history);
    }

    const owner = history;
    function listener(): void {
      onChange(owner.state(kScope));
    }
    owner.on("change", listener);
    const selection = unguardedRegistration(
      `selection:${this.#selections++}`,
      target.selection
    );
    const unregister = owner.register(selection);

    return {
      get state() {
        return owner.state(kScope);
      },
      undo: () => owner.undo(kScope),
      redo: () => owner.redo(kScope),
      record: (edit) => owner.record(kScope, null, edit),
      release: () => {
        owner.off("change", listener);
        unregister();
        selection.document.dispose();
      }
    };
  }
}
