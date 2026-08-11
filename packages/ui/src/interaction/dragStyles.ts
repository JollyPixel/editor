// CONSTANTS
const kStyleId = "jolly-drag-styles";

/**
 * Lazily installs document-level styles used during a scrub drag.
 */
export function ensureDragStyles(): void {
  if (
    typeof document === "undefined" ||
    document.getElementById(kStyleId) !== null
  ) {
    return;
  }

  const style = document.createElement("style");
  style.id = kStyleId;
  style.textContent = `
    html.jolly-scrub-dragging,
    html.jolly-scrub-dragging * {
      cursor: ew-resize !important;
      user-select: none !important;
    }
  `;

  document.head.append(style);
}
