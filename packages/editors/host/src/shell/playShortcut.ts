// CONSTANTS
export const PLAY_SCOPES = ["game", "scene"] as const;
const kPlayKey = "F5";

export type PlayScope = typeof PLAY_SCOPES[number];

export function playShortcut(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">
): PlayScope | null {
  if (event.key !== kPlayKey || event.altKey || event.shiftKey) {
    return null;
  }

  return event.ctrlKey || event.metaKey ? "scene" : "game";
}

export function forwardPlayShortcut(
  play: (scope: PlayScope) => void
): () => void {
  const listening = new AbortController();
  window.addEventListener("keydown", (event) => {
    const scope = playShortcut(event);
    if (scope !== null) {
      event.preventDefault();
      play(scope);
    }
  }, { capture: true, signal: listening.signal });

  return () => listening.abort();
}
