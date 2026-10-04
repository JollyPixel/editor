// CONSTANTS
const kDefaultLimit = 10;

export interface HistoryStackOptions {
  /**
   * @default 10
   */
  limit?: number;
}

export class HistoryStack<TEntry> {
  #limit: number;
  #undoStack: TEntry[] = [];
  #redoStack: TEntry[] = [];

  constructor(
    options: HistoryStackOptions = {}
  ) {
    this.#limit = options.limit ?? kDefaultLimit;
  }

  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  push(
    entry: TEntry
  ): void {
    this.#undoStack.push(entry);

    if (this.#undoStack.length > this.#limit) {
      this.#undoStack.shift();
    }
    this.#redoStack = [];
  }

  undo(): TEntry | null {
    const entry = this.#undoStack.pop();
    if (entry === undefined) {
      return null;
    }

    this.#redoStack.push(entry);

    return entry;
  }

  redo(): TEntry | null {
    const entry = this.#redoStack.pop();
    if (entry === undefined) {
      return null;
    }

    this.#undoStack.push(entry);

    return entry;
  }

  clear(): void {
    this.#undoStack = [];
    this.#redoStack = [];
  }
}
