export interface KeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
}

export interface KeyState {
  highlight: number;
  itemCount: number;
  browsingHistory: boolean;
  inlineCompletion: boolean;
}

export type ConsoleKeyAction =
  | "close"
  | "submit"
  | "accept"
  | "complete"
  | "history-previous"
  | "history-next"
  | "highlight-previous"
  | "highlight-next";

export function isToggleShortcut(
  event: KeyInput
): boolean {
  return event.key === "k" &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey;
}

export function resolveKey(
  event: KeyInput,
  state: KeyState
): ConsoleKeyAction | null {
  if (
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  ) {
    return null;
  }

  switch (event.key) {
    case "Escape":
      return "close";
    case "Enter":
      if (event.shiftKey) {
        return null;
      }

      return state.highlight >= 0 ? "accept" : "submit";
    case "Tab":
      return event.shiftKey ? null : "complete";
    case "ArrowUp":
      return state.browsingHistory || state.highlight < 0 ?
        "history-previous" :
        "highlight-previous";
    case "ArrowDown":
      if (state.browsingHistory) {
        return "history-next";
      }

      return state.itemCount > 0 ? "highlight-next" : null;
    case "ArrowRight":
      return state.inlineCompletion && !event.shiftKey ? "complete" : null;
    default:
      return null;
  }
}
