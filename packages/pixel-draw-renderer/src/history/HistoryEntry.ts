// Import Internal Dependencies
import type { SelectionRect } from "../types.ts";
import type { DocumentCommand } from "../sync/PixelCommand.ts";

export interface SelectionFootprint {
  rect: SelectionRect;
  mask: boolean[];
}

export interface SelectionChange {
  before: SelectionFootprint;
  after: SelectionFootprint;
}

export interface HistoryEdit {
  redo: DocumentCommand[];
  undo: DocumentCommand[];
  selection?: SelectionChange;
}

export interface HistoryEntry extends HistoryEdit {
  timestamp: number;
}
