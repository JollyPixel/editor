export type HistoryRefusal =
  | { reason: "peer"; clientId: string | null; }
  | { reason: "server"; }
  | { reason: "closed"; documentId: string; }
  | { reason: "changed"; }
  | { reason: "gone"; };

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
