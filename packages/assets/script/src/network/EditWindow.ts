// Import Internal Dependencies
import type { TextEdit } from "../model/TextEdit.ts";

interface CommittedEdit {
  readonly version: number;
  readonly edit: TextEdit;
}

// CONSTANTS
const kDefaultCapacity = 1_000;

export class EditWindow {
  #floor: number;
  #capacity: number;
  #edits: CommittedEdit[] = [];

  constructor(
    floor: number,
    capacity = kDefaultCapacity
  ) {
    this.#floor = floor;
    this.#capacity = capacity;
  }

  rebase(
    edit: TextEdit,
    basis: number
  ): TextEdit | null {
    if (basis < this.#floor) {
      return null;
    }

    let rebased = edit;
    for (const committed of this.#edits) {
      if (committed.version > basis) {
        rebased = rebased.rebaseOnto(committed.edit).edit;
      }
    }

    return rebased;
  }

  record(
    version: number,
    edit: TextEdit
  ): void {
    if (this.#edits.length === 0) {
      this.#floor = Math.min(this.#floor, version - 1);
    }
    this.#edits.push({
      version,
      edit
    });
    if (this.#edits.length > this.#capacity) {
      this.#floor = this.#edits.shift()?.version ?? this.#floor;
    }
  }

  reset(
    floor: number
  ): void {
    this.#floor = floor;
    this.#edits = [];
  }
}
