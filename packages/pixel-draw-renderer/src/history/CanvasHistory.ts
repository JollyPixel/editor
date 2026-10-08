// Import Internal Dependencies
import type { PixelDocument } from "../PixelDocument.ts";
import type {
  SelectionChange,
  SelectionFootprint
} from "../selection/SelectionFootprint.ts";
import type { EditSource } from "../sync/EditChange.ts";
import type { EditGrouping } from "../sync/EditRecorder.ts";
import { SelectionEdits } from "./SelectionEdits.ts";

// CONSTANTS
const kNoHistory: PixelHistoryBinding = {
  state: {
    canUndo: false,
    canRedo: false,
    undoLabel: null,
    redoLabel: null,
    undoCount: 0,
    redoCount: 0
  },
  undo: () => false,
  redo: () => false,
  record: (edit) => edit(),
  release: () => undefined
};

export interface PixelHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  undoCount: number;
  redoCount: number;
}

export interface PixelHistoryTarget {
  document: PixelDocument;
  /**
   * The canvas's selection changes, recorded beside the document's so an undo
   * restores the selection it replaced.
   */
  selection: EditSource<SelectionChange>;
}

export interface PixelHistoryBinding {
  readonly state: PixelHistoryState;
  undo(): boolean;
  redo(): boolean;
  record: EditGrouping;
  release(): void;
}

export interface PixelArtCanvasHistory {
  bind(
    target: PixelHistoryTarget,
    onChange: (state: PixelHistoryState) => void
  ): PixelHistoryBinding;
}

export interface CanvasHistoryOptions {
  document: PixelDocument;
  history?: PixelArtCanvasHistory;
  restoreSelection: (footprint: SelectionFootprint) => void;
  onChange?: (state: PixelHistoryState) => void;
}

export class CanvasHistory {
  #selection = new SelectionEdits();
  #binding: PixelHistoryBinding;

  constructor(
    options: CanvasHistoryOptions
  ) {
    const target = {
      document: options.document,
      selection: this.#selection
    };
    this.#binding = options.history?.bind(target, (state) => {
      const restored = this.#selection.takeRestored();
      if (restored !== null) {
        options.restoreSelection(restored);
      }
      options.onChange?.(state);
    }) ?? kNoHistory;
  }

  get state(): PixelHistoryState {
    return this.#binding.state;
  }

  undo(): boolean {
    return this.#binding.undo();
  }

  redo(): boolean {
    return this.#binding.redo();
  }

  recordSelectionEdit(
    change: SelectionChange,
    edit: () => void
  ): void {
    this.#binding.record(() => {
      this.#selection.record(change);
      edit();
    });
  }

  destroy(): void {
    this.#binding.release();
    this.#binding = kNoHistory;
  }
}
