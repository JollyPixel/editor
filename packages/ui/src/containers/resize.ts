// Import Third-party Dependencies
import type { ResizeHandle } from "@jolly-pixel/resize-handle";

// Import Internal Dependencies
import { emitContainerEvent } from "./events.ts";
import { ensureDocumentStyles } from "../interaction/ensureDocumentStyles.ts";

// CONSTANTS
export function installResizeCursorStyles(
  document: Document
): void {
  ensureDocumentStyles("jolly-resize-cursors", `
    html.handle-dragging.vertical * { cursor: ew-resize !important; }
    html.handle-dragging.horizontal * { cursor: ns-resize !important; }
  `, document);
}

export function forwardResizeEvents(
  owner: HTMLElement,
  resizeHandle: ResizeHandle,
  detail: () => {
    width: number;
    height: number;
    collapsed: boolean;
  },
  onEnd: () => void
): () => void {
  function onResize(): void {
    emitContainerEvent(
      owner,
      "jolly-resize",
      detail()
    );
  }

  function onResizeEnd(): void {
    onEnd();
    emitContainerEvent(
      owner,
      "jolly-resize-end",
      detail()
    );
  }
  resizeHandle.addEventListener("drag", onResize);
  resizeHandle.addEventListener("dragEnd", onResizeEnd);

  return () => {
    resizeHandle.removeEventListener("drag", onResize);
    resizeHandle.removeEventListener("dragEnd", onResizeEnd);
  };
}
