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
  "selection-progress": (event: SelectionProgressEvent) => void;
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
