// Import Internal Dependencies
import {
  HistoryStack,
  type HistoryEntry,
  type HistoryEntryInput
} from "./HistoryStack.ts";
import type { DefaultPixelBuffer } from "../buffer/types.ts";

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

export interface HistoryControllerOptions {
  /**
   * @default false
   **/
  enabled?: boolean;
  /**
   * @default 10
   */
  limit?: number;
  /** Called whenever the undo/redo stack changes (push, undo, redo, clear). */
  onChange?: (state: HistoryState) => void;
}

/**
 * Owns the optional HistoryStack and its change notifications. Callers stay
 * responsible for the side effects that go with undo/redo (buffer refresh,
 * hook replay, tool resync) — this class only tracks entries and reports
 * canUndo/canRedo state.
 */
export class HistoryController {
  #stack?: HistoryStack;
  #onChange?: (state: HistoryState) => void;

  constructor(
    buffer: DefaultPixelBuffer,
    options: HistoryControllerOptions = {}
  ) {
    if (options.enabled) {
      this.#stack = new HistoryStack(buffer, {
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

  push(
    entry: HistoryEntryInput
  ): void {
    if (!this.#stack) {
      return;
    }

    this.#stack.push(entry);
    this.#notify();
  }

  undo(): HistoryEntry | null {
    const entry = this.#stack?.undo() ?? null;
    if (entry) {
      this.#notify();
    }

    return entry;
  }

  redo(): HistoryEntry | null {
    const entry = this.#stack?.redo() ?? null;
    if (entry) {
      this.#notify();
    }

    return entry;
  }

  /** Discards every recorded entry, e.g. after a remote structural change. */
  clear(): void {
    if (!this.#stack) {
      return;
    }

    this.#stack.clear();
    this.#notify();
  }

  #notify(): void {
    this.#onChange?.({
      canUndo: this.canUndo,
      canRedo: this.canRedo
    });
  }
}
