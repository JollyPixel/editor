// Import Third-party Dependencies
import type { ScriptDocument } from "@jolly-pixel/asset.script/client";

// Import Internal Dependencies
import "./MarkdownView.ts";

export interface MarkdownPreviewOptions {
  document: ScriptDocument;
  code: HTMLElement;
  readOnly: boolean;
}

// CONSTANTS
const kRenderDelayMs = 150;

export function bindMarkdownPreview(
  options: MarkdownPreviewOptions
): () => void {
  const { document, code, readOnly } = options;
  const view = window.document.querySelector("jolly-markdown");
  if (view === null) {
    throw new Error("bindMarkdownPreview: the page is missing a Markdown preview pane.");
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  view.markdown = document.text;
  view.hidden = false;
  code.hidden = readOnly;
  const unsubscribe = document.subscribe("change", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      view.markdown = document.text;
    }, kRenderDelayMs);
  });

  return () => {
    unsubscribe();
    clearTimeout(timer);
    view.hidden = true;
    code.hidden = false;
  };
}
