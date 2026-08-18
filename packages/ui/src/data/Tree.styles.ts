// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/styles/fallbacks.ts";

export const treeStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    min-width: 0;
    color: var(--jolly-text, ${kFallback.text});
    font: inherit;
    user-select: none;
  }

  .rows {
    display: flex;
    flex-direction: column;
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    min-height: var(--jolly-row-height, 20px);
    padding-inline-end: var(--jolly-space-1, 4px);
    border-radius: var(--jolly-radius-sm, 2px);
    cursor: default;
  }

  .row:hover {
    background: var(--jolly-control-bg-hover, ${kFallback.controlBg});
  }

  .row[aria-selected="true"] {
    background: var(--jolly-control-bg-focus, ${kFallback.controlBg});
  }

  .row:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--jolly-focus-ring, ${kFallback.focusRing});
  }

  .toggle,
  .toggle-spacer {
    flex: 0 0 auto;
    width: var(--jolly-control-height, 20px);
    height: var(--jolly-control-height, 20px);
  }

  .toggle {
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--jolly-text-muted, ${kFallback.text});
    cursor: pointer;
  }

  .toggle jolly-icon {
    width: 10px;
    height: 10px;
    transform-origin: center;
    transition: transform var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .row[aria-expanded="true"] .toggle jolly-icon {
    transform: rotate(90deg);
  }

  .node-icon {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
    color: var(--jolly-text-muted, ${kFallback.text});
  }

  .label {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Mirrors the eye toggle's own state: a row with visible=false reads as
     hidden at a glance, not only through its icon. */
  .row[data-hidden="true"] .label,
  .row[data-hidden="true"] .node-icon {
    opacity: 0.5;
  }

  .visible-toggle,
  .lock-toggle,
  .grip {
    flex: 0 0 auto;
    display: none;
    width: var(--jolly-control-height, 20px);
    height: var(--jolly-control-height, 20px);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--jolly-text-muted, ${kFallback.text});
    cursor: pointer;
  }

  .visible-toggle,
  .lock-toggle {
    display: grid;
    place-items: center;
  }

  .visible-toggle[data-active="false"],
  .lock-toggle[data-active="false"] {
    opacity: 0.4;
  }

  :host([reorderable]) .grip {
    display: grid;
    place-items: center;
    cursor: grab;
    touch-action: none;
  }

  .visible-toggle jolly-icon,
  .lock-toggle jolly-icon,
  .grip jolly-icon {
    width: 12px;
    height: 12px;
  }

  /* The source dims in place while a drag session previews its new position. */
  .row[data-dragging="true"] {
    opacity: 0.4;
  }

  .row[data-drop="above"] {
    box-shadow: inset 0 1px 0 0 var(--jolly-accent-fill, ${kFallback.focusRing});
  }

  .row[data-drop="below"] {
    box-shadow: inset 0 -1px 0 0 var(--jolly-accent-fill, ${kFallback.focusRing});
  }

  .row[data-drop="inside"] {
    box-shadow: inset 0 0 0 1px var(--jolly-accent-fill, ${kFallback.focusRing});
  }

  .row[data-move-cursor="true"] {
    outline: 1px dashed var(--jolly-accent-fill, ${kFallback.focusRing});
    outline-offset: -1px;
  }
`;
