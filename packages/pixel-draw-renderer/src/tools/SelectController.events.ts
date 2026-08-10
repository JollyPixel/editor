// Import Internal Dependencies
import type { SelectionRect } from "../types.ts";

/**
 * Live in-progress selection geometry for ghost-preview streaming.
 * `creating` is always a plain rect; `moving` carries the existing mask
 * and blankSource state mirroring FloatingSelectionOptions.blankSource.
 */
export type SelectionProgressEvent =
  | {
    phase: "creating";
    rect: SelectionRect;
  }
  | {
    phase: "moving";
    sourceRect: SelectionRect;
    liveRect: SelectionRect;
    mask: boolean[];
    blankSource: boolean;
  };

export type SelectControllerEvent = {
  /**
   * `isFloating` marks a paste that has not been deposited yet: deselecting
   * it writes it to the buffer, deleting it cancels it.
   */
  "selection-state-changed": (
    event: {
      hasSelection: boolean;
      isFloating: boolean;
    }
  ) => void;
  "selection-progress": (
    event: SelectionProgressEvent
  ) => void;
  /**
   * Signals that the command replaced any pending ghost tick.
   */
  "selection-committed": () => void;
  /**
   * Signals that presence must clear because no command follows.
   */
  "selection-idle": () => void;
};

export type SelectControllerEventType = keyof SelectControllerEvent;
