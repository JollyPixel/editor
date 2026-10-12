// Import Internal Dependencies
import { ensureDocumentStyles } from "../ensureDocumentStyles.ts";

// CONSTANTS
export const GRABBING_CLASS = "jolly-pane-dragging";

export function ensureGrabbingStyles(): void {
  ensureDocumentStyles("jolly-drag-session-styles", `
    html.${GRABBING_CLASS},
    html.${GRABBING_CLASS} * {
      cursor: grabbing !important;
      user-select: none !important;
    }
  `);
}
