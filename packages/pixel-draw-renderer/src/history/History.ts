// Import Internal Dependencies
import { HistoryStack } from "./HistoryStack.ts";
import type {
  HistoryEdit,
  HistoryEntry
} from "./HistoryEntry.ts";

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
}

export interface HistoryOptions {
  /**
   * @default false
   */
  enabled?: boolean;
  /**
   * @default 10
   */
  limit?: number;
  onChange?: (state: HistoryState) => void;
}

export type HistoryReplay = (entry: HistoryEntry) => void;

export class History {
  #stack?: HistoryStack<HistoryEntry>;
  #onChange?: (state: HistoryState) => void;

  constructor(
    options: HistoryOptions = {}
  ) {
    if (options.enabled) {
      this.#stack = new HistoryStack({
        limit: options.limit
      });
    }
    this.#onChange = options.onChange;
  }

  get enabled(): boolean {
    return this.#stack !== undefined;
  }

  get canUndo(): boolean {
    return this.#stack?.canUndo ?? false;
  }

  get canRedo(): boolean {
    return this.#stack?.canRedo ?? false;
  }

  get undoDepth(): number {
    return this.#stack?.undoDepth ?? 0;
  }

  get redoDepth(): number {
    return this.#stack?.redoDepth ?? 0;
  }

  push(
    edit: HistoryEdit
  ): void {
    if (!this.#stack) {
      return;
    }

    this.#stack.push({
      ...edit,
      timestamp: Date.now()
    });
    this.#notify();
  }

  undo(
    replay: HistoryReplay
  ): HistoryEntry | null {
    return this.#replay(
      this.#stack?.undo() ?? null,
      replay
    );
  }

  redo(
    replay: HistoryReplay
  ): HistoryEntry | null {
    return this.#replay(
      this.#stack?.redo() ?? null,
      replay
    );
  }

  clear(): void {
    if (!this.#stack) {
      return;
    }

    this.#stack.clear();
    this.#notify();
  }

  #replay(
    entry: HistoryEntry | null,
    replay: HistoryReplay
  ): HistoryEntry | null {
    if (entry !== null) {
      replay(entry);
      this.#notify();
    }

    return entry;
  }

  #notify(): void {
    this.#onChange?.({
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      undoDepth: this.undoDepth,
      redoDepth: this.redoDepth
    });
  }
}
