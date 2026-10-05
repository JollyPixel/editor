// Import Internal Dependencies
import type { SelectionPresence } from "../selection/SelectionPresence.ts";
import type { SelectionRect } from "../types.ts";

export type SelectionProgressEvent =
  | {
    phase: "creating";
    rect: SelectionRect;
  }
  | {
    phase: "moving";
    sourceRect: SelectionRect;
    liveRect: SelectionRect;
    mask: readonly boolean[];
    blankSource: boolean;
  };

export type SelectEngineEvent = {
  "selection-presence-changed": (
    state: SelectionPresence | null
  ) => void;
  "selection-state-changed": (
    event: {
      hasSelection: boolean;
      isFloating: boolean;
    }
  ) => void;
  "selection-progress": (
    event: SelectionProgressEvent
  ) => void;
  "selection-committed": () => void;
  "selection-idle": () => void;
};

export type SelectEngineEventType = keyof SelectEngineEvent;
