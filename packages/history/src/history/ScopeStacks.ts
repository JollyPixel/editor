// Import Internal Dependencies
import type { HistoryStep } from "./HistoryStep.ts";
import type {
  HistoryScopeState,
  HistoryStepInfo
} from "./HistoryState.ts";

export type StackSide = "undo" | "redo";

export interface StackPosition {
  readonly side: StackSide;
  readonly index: number;
}

export class ScopeStacks<
  TScope extends string
> {
  #limit: number;
  #stacks: Record<StackSide, HistoryStep<TScope>[]> = {
    undo: [],
    redo: []
  };

  constructor(
    limit: number
  ) {
    this.#limit = limit;
  }

  get state(): HistoryScopeState {
    const undoable = this.#stacks.undo.filter(({ refused }) => !refused);
    const redoable = this.#stacks.redo.filter(({ refused }) => !refused);

    return {
      canUndo: undoable.length > 0,
      canRedo: redoable.length > 0,
      undoLabel: undoable.at(-1)?.label ?? null,
      redoLabel: redoable.at(-1)?.label ?? null,
      undoCount: undoable.length,
      redoCount: redoable.length,
      refused: [...this]
        .map(({ info }) => info)
        .filter((info): info is HistoryStepInfo => info !== null)
        .reverse()
    };
  }

  record(
    step: HistoryStep<TScope>
  ): void {
    this.#stacks.redo = [];
    this.push("undo", step);
  }

  push(
    side: StackSide,
    step: HistoryStep<TScope>
  ): void {
    const stack = this.#stacks[side];
    stack.push(step);
    if (stack.length > this.#limit) {
      stack.shift();
    }
  }

  * newestFirst(
    side: StackSide
  ): IterableIterator<HistoryStep<TScope>> {
    yield* this.#stacks[side].toReversed();
  }

  take(
    step: HistoryStep<TScope>
  ): StackPosition | null {
    for (const side of ["undo", "redo"] as const) {
      const index = this.#stacks[side].indexOf(step);
      if (index !== -1) {
        this.#stacks[side].splice(index, 1);

        return { side, index };
      }
    }

    return null;
  }

  insert(
    position: StackPosition,
    step: HistoryStep<TScope>
  ): void {
    this.#stacks[position.side].splice(position.index, 0, step);
  }

  clear(): void {
    this.#stacks = {
      undo: [],
      redo: []
    };
  }

  * [Symbol.iterator](): IterableIterator<HistoryStep<TScope>> {
    yield* this.#stacks.undo;
    yield* this.#stacks.redo;
  }
}
