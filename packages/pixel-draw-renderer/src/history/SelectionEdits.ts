// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  SelectionChange,
  SelectionFootprint
} from "../selection/SelectionFootprint.ts";
import {
  EditChange,
  type EditSource
} from "../sync/EditChange.ts";

export type SelectionEditChange = EditChange<SelectionChange>;

export type SelectionEditsEvents = {
  change: (change: SelectionEditChange) => void;
  reset: (cause: "load") => void;
};

export class SelectionEdits extends Emitter<SelectionEditsEvents>
  implements EditSource<SelectionChange> {
  #restored: SelectionFootprint | null = null;

  record(
    change: SelectionChange
  ): void {
    this.#emitLocal(change);
  }

  applyStep(
    command: SelectionChange
  ): SelectionEditChange {
    this.#restored = command.after;

    return this.#emitLocal(command);
  }

  takeRestored(): SelectionFootprint | null {
    const restored = this.#restored;
    this.#restored = null;

    return restored;
  }

  #emitLocal(
    command: SelectionChange
  ): SelectionEditChange {
    const change = EditChange.local(command, [
      {
        before: command.after,
        after: command.before
      }
    ]);
    this.emit("change", change);

    return change;
  }
}
