// CONSTANTS
const kDefaultMaxSize = 100;

export interface UVCommand {
  readonly type: string;
  readonly regionId: string;
  /** Apply (or re-apply for redo) the change. */
  execute(): void;
  /** Reverse the change. */
  undo(): void;
  /**
   * Called on the stack-top command with an incoming command of the same
   * logical operation (e.g. continuous drag). Implementations should absorb
   * the incoming command's delta and return true to prevent a new entry being
   * pushed to the stack.
   */
  tryMerge?(incoming: UVCommand): boolean;
}

export interface UVHistoryOptions {
  maxSize?: number;
}

/**
 * Command-pattern undo/redo stack for UV region mutations.
 * Callers push commands AFTER already applying the change to the data model;
 * `push` itself does NOT call `execute()`. The `execute()` method is reserved
 * for `redo()`.
 */
export class UVHistory {
  readonly maxSize: number;

  #undoStack: UVCommand[] = [];
  #redoStack: UVCommand[] = [];

  constructor(
    options?: UVHistoryOptions
  ) {
    this.maxSize = options?.maxSize ?? kDefaultMaxSize;
  }

  /**
   * Record a command that has already been applied.
   * If the stack top accepts the incoming command via `tryMerge`, the incoming
   * command is absorbed (no new entry). Otherwise it is appended.
   * Pushing always clears the redo stack.
   */
  push(
    command: UVCommand
  ): void {
    this.#redoStack = [];

    if (this.#undoStack.length > 0) {
      const top = this.#undoStack[this.#undoStack.length - 1];
      if (top.tryMerge?.(command)) {
        return;
      }
    }

    this.#undoStack.push(command);
    if (this.#undoStack.length > this.maxSize) {
      this.#undoStack.shift();
    }
  }

  undo(): void {
    const command = this.#undoStack.pop();
    if (!command) {
      return;
    }

    command.undo();
    this.#redoStack.push(command);
  }

  redo(): void {
    const command = this.#redoStack.pop();
    if (!command) {
      return;
    }

    command.execute();
    this.#undoStack.push(command);
  }

  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  clear(): void {
    this.#undoStack = [];
    this.#redoStack = [];
  }
}
