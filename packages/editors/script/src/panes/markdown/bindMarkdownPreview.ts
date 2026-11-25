// Import Third-party Dependencies
import type { ScriptDocument } from "@jolly-pixel/asset.script/client";

// Import Internal Dependencies
import {
  canEditText,
  type ScriptAccessSource
} from "../../access/ScriptAccess.ts";
import "./MarkdownView.ts";

export interface MarkdownPreviewOptions {
  document: ScriptDocument;
  code: HTMLElement;
  access: ScriptAccessSource;
}

// CONSTANTS
const kRenderDelayMs = 150;

export function bindMarkdownPreview(
  options: MarkdownPreviewOptions
): () => void {
  const { document, code, access } = options;
  const view = window.document.querySelector("jolly-markdown");
  if (view === null) {
    throw new Error("bindMarkdownPreview: the page is missing a Markdown preview pane.");
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  view.markdown = document.text;
  view.hidden = false;
  code.hidden = !canEditText(access.current);
  const unfollowAccess = access.subscribe("change", (grants) => {
    code.hidden = !canEditText(grants);
  });
  const unsubscribe = document.subscribe("change", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      view.markdown = document.text;
    }, kRenderDelayMs);
  });

  return () => {
    unfollowAccess();
    unsubscribe();
    clearTimeout(timer);
    view.hidden = true;
    code.hidden = false;
  };
}
