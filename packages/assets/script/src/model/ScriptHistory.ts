// Import Internal Dependencies
import { TextEdit } from "../text/TextEdit.ts";

interface HistoryStep {
  readonly revert: TextEdit;
  readonly at: number;
}

// CONSTANTS
const kGroupWindowMs = 700;

export class ScriptHistory {
  #undo: HistoryStep[] = [];
  #redo: HistoryStep[] = [];
  #grouping = false;

  get canUndo(): boolean {
    return this.#undo.length > 0;
  }

  get canRedo(): boolean {
    return this.#redo.length > 0;
  }

  record(
    edit: TextEdit
  ): void {
    if (edit.empty) {
      return;
    }

    const now = Date.now();
    const top = this.#undo.at(-1);
    const revert = edit.invert();
    if (this.#grouping && top !== undefined && now - top.at <= kGroupWindowMs) {
      this.#undo[this.#undo.length - 1] = {
        revert: revert.then(top.revert),
        at: now
      };
    }
    else {
      this.#undo.push({
        revert,
        at: now
      });
    }
    this.#grouping = true;
    this.#redo = [];
  }

  undo(): TextEdit | null {
    return this.#move(this.#undo, this.#redo);
  }

  redo(): TextEdit | null {
    return this.#move(this.#redo, this.#undo);
  }

  rebase(
    remote: TextEdit
  ): void {
    this.#undo = rebaseSteps(this.#undo, remote);
    this.#redo = rebaseSteps(this.#redo, remote);
  }

  clear(): void {
    this.#undo = [];
    this.#redo = [];
    this.#grouping = false;
  }

  #move(
    from: HistoryStep[],
    to: HistoryStep[]
  ): TextEdit | null {
    this.#grouping = false;
    const step = from.pop();
    if (step === undefined) {
      return null;
    }

    to.push({
      revert: step.revert.invert(),
      at: step.at
    });

    return step.revert;
  }
}

function rebaseSteps(
  steps: readonly HistoryStep[],
  remote: TextEdit
): HistoryStep[] {
  const rebased: HistoryStep[] = [];
  let earlier = remote;
  for (const step of steps.toReversed()) {
    const { edit, earlier: next } = step.revert.rebaseOnto(earlier);
    earlier = next;
    if (!edit.empty) {
      rebased.push({
        revert: edit,
        at: step.at
      });
    }
  }

  return rebased.toReversed();
}
