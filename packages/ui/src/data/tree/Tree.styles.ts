// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../../theme/styles/fallbacks.ts";
import { truncate } from "../../theme/styles/mixins.ts";

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
    flex: 1 1 auto;
    flex-direction: column;
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    min-height: var(--jolly-row-height, 20px);
    border-radius: var(--jolly-radius-sm, 2px);
    cursor: default;
  }

  :host([virtual]) {
    min-height: 0;
  }

  :host([virtual]) .row {
    width: 100%;
  }

  .row:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--jolly-focus-ring, ${kFallback.focusRing});
  }

  .toggle,
  .toggle-spacer {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
  }

  .toggle {
    position: relative;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--jolly-text-muted, ${kFallback.text});
    cursor: pointer;
  }

  .toggle::before {
    content: "";
    position: absolute;
    inset: -4px;
  }

  .toggle jolly-icon {
    width: 12px;
    height: 12px;
    transform-origin: center;
    transition: transform var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .row[aria-expanded="true"] .toggle jolly-icon {
    transform: rotate(90deg);
  }

  .content {
    display: flex;
    align-items: center;
    align-self: stretch;
    flex: 1 1 auto;
    min-width: 0;
    gap: var(--jolly-space-1, 4px);
    padding-inline: var(--jolly-tree-row-padding-inline, var(--jolly-space-1, 4px));
    border-radius: inherit;
  }

  .row:hover .content {
    background: var(--jolly-control-bg-hover, ${kFallback.controlBg});
  }

  .row[aria-selected="true"] .content {
    background: var(--jolly-control-bg-focus, ${kFallback.controlBg});
  }

  .node-icon {
    flex: 0 0 auto;
    width: var(--jolly-tree-icon-size, 12px);
    height: var(--jolly-tree-icon-size, 12px);
    color: var(--jolly-text-muted, ${kFallback.text});
  }

  .node-avatar {
    --jolly-avatar-size: var(--jolly-tree-avatar-size, 16px);
  }

  .row:hover .node-icon,
  .row[aria-selected="true"] .node-icon {
    --jolly-icon-tone-strength: var(--jolly-icon-tone-engaged, 100%);
  }

  .label {
    flex: 1 1 auto;

    ${truncate}
  }

  .detail {
    flex: 0 0 auto;
    color: var(--jolly-text-muted, ${kFallback.text});
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .badges {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    padding-inline: var(--jolly-space-1, 4px);
  }

  .badge-icon {
    flex: 0 0 auto;
    width: var(--jolly-tree-icon-size, 12px);
    height: var(--jolly-tree-icon-size, 12px);
  }

  .badge {
    width: 8px;
    height: 8px;
    flex: 0 0 auto;
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--jolly-surface, ${kFallback.controlBg});
  }

  .swatch {
    --jolly-swatch-checker: color-mix(in oklab, var(--jolly-ink) 18%, transparent);

    flex: 0 0 auto;
    width: 10px;
    height: 10px;
    margin-inline: var(--jolly-space-1, 4px);
    padding: 0;
    border: 1px solid color-mix(in oklab, var(--jolly-ink) 35%, transparent);
    border-radius: 2px;
    outline: 1.5px solid var(--jolly-tree-swatch-ring, transparent);
    outline-offset: 1px;
    background-color: var(--jolly-surface-raised, ${kFallback.controlBg});
    background-image:
      linear-gradient(
        var(--jolly-tree-swatch-color, transparent),
        var(--jolly-tree-swatch-color, transparent)
      ),
      conic-gradient(
        var(--jolly-swatch-checker) 25%,
        transparent 0 50%,
        var(--jolly-swatch-checker) 0 75%,
        transparent 0
      );
    background-size: auto, 4px 4px;
    cursor: pointer;
  }

  :host([swatch-position="start"]) .swatch {
    margin-inline: 0;
  }

  .swatch[data-empty="true"] {
    visibility: hidden;
    border-style: dashed;
    background: transparent;
  }

  .row:hover .swatch[data-empty="true"],
  .row[aria-selected="true"] .swatch[data-empty="true"] {
    visibility: visible;
  }

  .rename {
    min-width: 0;
    padding: 0;
    border: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    outline: 1px solid var(--jolly-focus-ring, ${kFallback.focusRing});
    outline-offset: 1px;
    background: var(--jolly-control-bg, ${kFallback.controlBg});
    color: var(--jolly-text, ${kFallback.text});
    font: inherit;
  }

  .rename[aria-invalid="true"] {
    outline-color: var(--jolly-danger-border, ${kFallback.inkDanger});
  }

  .rename-error {
    position: absolute;
    z-index: 1;
    top: 100%;
    inset-inline-start: var(--jolly-tree-row-indent, 0);
    max-width: calc(100% - var(--jolly-tree-row-indent, 0px));
    padding: 2px var(--jolly-space-1, 4px);
    border: 1px solid var(--jolly-danger-border, ${kFallback.inkDanger});
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-surface-raised, ${kFallback.controlBg});
    box-shadow: var(--jolly-shadow-overlay, none);
    color: var(--jolly-danger, ${kFallback.inkDanger});
    font-size: 0.9em;
    white-space: normal;
    pointer-events: none;
  }

  .row[data-warning="true"] .label {
    color: var(--jolly-danger, ${kFallback.inkDanger});
  }

  .warning {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    color: var(--jolly-danger, ${kFallback.inkDanger});
  }

  .row[data-hidden="true"] .label,
  .row[data-hidden="true"] .node-icon,
  .row[data-hidden="true"] .node-avatar {
    opacity: 0.5;
  }

  .visible-toggle,
  .lock-toggle,
  .grip {
    flex: 0 0 auto;
    display: none;
    width: 16px;
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

  .visible-toggle + .lock-toggle,
  .visible-toggle + .grip,
  .lock-toggle + .grip {
    margin-inline-start: calc(-1 * var(--jolly-space-1, 4px));
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

  .row[data-dragging="true"] {
    opacity: 0.4;
  }

  .row::after {
    content: "";
    position: absolute;
    pointer-events: none;
    opacity: 0;
  }

  .row[data-drop="above"]::after,
  .row[data-drop="below"]::after {
    inset-inline: var(--jolly-tree-drop-indent, 0) 0;
    height: 1px;
    background: var(--jolly-accent-fill, ${kFallback.focusRing});
    opacity: 1;
  }

  .row[data-drop="above"]::after {
    top: 0;
  }

  .row[data-drop="below"]::after {
    bottom: 0;
  }

  .row[data-drop="inside"]::after {
    inset-block: 0;
    inset-inline: var(--jolly-tree-drop-indent, 0) 0;
    border: 1px solid var(--jolly-accent-fill, ${kFallback.focusRing});
    border-radius: inherit;
    opacity: 1;
  }

  .row[data-move-cursor="true"] {
    outline: 1px dashed var(--jolly-accent-fill, ${kFallback.focusRing});
    outline-offset: -1px;
  }

  :host([indent-guides]) .row::before {
    content: "";
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    width: var(--jolly-tree-row-indent, 0);
    background-image: repeating-linear-gradient(
      to right,
      var(--jolly-tree-guide-color, var(--jolly-border, ${kFallback.borderStrong})) 0,
      var(--jolly-tree-guide-color, var(--jolly-border, ${kFallback.borderStrong})) 1px,
      transparent 1px,
      transparent var(--jolly-tree-indent, 16px)
    );
    background-position: 5px 0;
    pointer-events: none;
  }
`;
