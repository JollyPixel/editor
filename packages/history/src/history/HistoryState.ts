export type HistoryRefusal =
  /**
   * A peer changed a value the step would write back.
   */
  | { reason: "peer"; clientId: string | null; }
  /**
   * The server refused the step's edit, or the undo or redo of it.
   */
  | { reason: "server"; }
  /**
   * A document the step touched is not open in this history.
   */
  | { reason: "closed"; documentId: string; }
  /**
   * A value the step would write back changed through a write no change
   * reported, such as a snapshot load or a voxel layer moved under its cells.
   */
  | { reason: "changed"; }
  /**
   * The documents refused every command of the step.
   */
  | { reason: "gone"; }
  /**
   * The sync client dropped the step's edit unsent, past its offline bound.
   */
  | { reason: "dropped"; };

export interface HistoryStepInfo {
  readonly label: string | null;
  readonly refused: HistoryRefusal;
}

export interface HistoryScopeState {
  /**
   * This flag and the labels and counts below leave refused steps out.
   */
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  undoCount: number;
  redoCount: number;
  /**
   * Refused steps of both stacks, newest first.
   */
  refused: readonly HistoryStepInfo[];
}

export const EMPTY_HISTORY_STATE: Readonly<HistoryScopeState> = Object.freeze({
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
  undoCount: 0,
  redoCount: 0,
  refused: Object.freeze([])
});
