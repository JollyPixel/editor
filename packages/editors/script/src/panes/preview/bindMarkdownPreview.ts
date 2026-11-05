// Import Third-party Dependencies
import type { ScriptDocument } from "@jolly-pixel/asset.script/client";
import type { MarkdownView } from "@jolly-pixel/asset.script/markdown";

// CONSTANTS
const kRenderDelayMs = 150;

export function bindMarkdownPreview(
  view: MarkdownView,
  document: ScriptDocument
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  view.markdown = document.text;
  view.hidden = false;
  const unsubscribe = document.subscribe("change", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      view.markdown = document.text;
    }, kRenderDelayMs);
  });

  return () => {
    unsubscribe();
    clearTimeout(timer);
  };
}
