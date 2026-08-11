// Import Third-party Dependencies
import type { ResizeHandle } from "@jolly-pixel/resize-handle";

// Import Internal Dependencies
import { emitContainerEvent } from "./events.ts";

// CONSTANTS
const kStyleMarker = "data-jolly-resize-cursors";

export function installResizeCursorStyles(
  document: Document
): void {
  if (document.head.querySelector(`[${kStyleMarker}]`) !== null) {
    return;
  }

  const style = document.createElement("style");
  style.setAttribute(kStyleMarker, "");
  style.textContent = `
    html.handle-dragging.vertical * { cursor: ew-resize !important; }
    html.handle-dragging.horizontal * { cursor: ns-resize !important; }
  `;
  document.head.append(style);
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
