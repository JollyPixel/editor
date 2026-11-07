// CONSTANTS
export const EDITOR_STATE_ATTRIBUTE = "data-editor-state";
export const EDITOR_STATES = [
  "booting",
  "switching",
  "ready",
  "failed"
] as const;

export type EditorState = typeof EDITOR_STATES[number];
