// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  ChangeReceipts,
  CommandChange,
  KeyedGuard,
  type DocumentResetCause,
  type HistoryRegistration
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type {
  SelectionChange,
  SelectionFootprint
} from "../selection/SelectionFootprint.ts";

export type SelectionHistoryChange = CommandChange<SelectionChange, null>;

export type SelectionHistoryEvents = {
  change: (change: SelectionHistoryChange) => void;
  reset: (cause: DocumentResetCause) => void;
};

export class SelectionHistory extends Emitter<SelectionHistoryEvents> {
  readonly receipts = new ChangeReceipts<SelectionHistoryChange>();

  #restored: SelectionFootprint | null = null;

  record(
    change: SelectionChange
  ): void {
    this.#emitLocal(change);
  }

  applyStep(
    command: SelectionChange,
    basis: number | undefined
  ): SelectionHistoryChange {
    this.#restored = command.after;

    return this.#emitLocal(command, basis);
  }

  takeRestored(): SelectionFootprint | null {
    const restored = this.#restored;
    this.#restored = null;

    return restored;
  }

  registration<TScope extends string>(
    id: string,
    scope: TScope
  ): HistoryRegistration<TScope, SelectionChange, null> {
    return {
      id,
      document: this,
      keys: {
        written: () => [],
        guard: () => new KeyedGuard([])
      },
      scopeOf: () => scope
    };
  }

  #emitLocal(
    command: SelectionChange,
    basis?: number
  ): SelectionHistoryChange {
    const change = CommandChange.local(
      command,
      null,
      [
        {
          before: command.after,
          after: command.before
        }
      ],
      basis
    );
    this.emit("change", change);

    return change;
  }
}
