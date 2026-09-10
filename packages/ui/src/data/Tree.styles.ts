// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/styles/fallbacks.ts";
import { truncate } from "../theme/styles/mixins.ts";

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

  .node-icon {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
    color: var(--jolly-text-muted, ${kFallback.text});
  }

  .label {
    flex: 1 1 auto;
    ${truncate}
  }

  .badges {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    padding-inline: var(--jolly-space-1, 4px);
  }

  .badge {
    width: 8px;
    height: 8px;
    flex: 0 0 auto;
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--jolly-surface, ${kFallback.controlBg});
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

  .row[data-hidden="true"] .label,
  .row[data-hidden="true"] .node-icon {
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

  /*
   * Always generated, invisible by default, and only ever repositioned or
   * made visible by a "data-drop" rule below: Chromium has been seen to
   * leave a stale sliver painted where this pseudo-element used to be when
   * it is instead created and destroyed by an attribute selector starting
   * or stopping matching. Toggling opacity on a box that always exists
   * does not have that failure mode.
   *
   * Pseudo-element, not box-shadow, for the above/below line: it needs its
   * own inline-start so it hugs the row's content instead of also spanning
   * the blank indent gutter to its left.
   */
  .row::after {
    content: "";
    position: absolute;
    pointer-events: none;
    opacity: 0;
  }

  .row[data-drop="above"]::after,
  .row[data-drop="below"]::after {
    inset-inline: var(--jolly-tree-row-indent, 0px) 0;
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
    inset-inline: var(--jolly-tree-row-indent, 0px) 0;
    border: 1px solid var(--jolly-accent-fill, ${kFallback.focusRing});
    border-radius: inherit;
    opacity: 1;
  }

  .row[data-move-cursor="true"] {
    outline: 1px dashed var(--jolly-accent-fill, ${kFallback.focusRing});
    outline-offset: -1px;
  }

  /*
   * One line per ancestor level, centered in that level's indent unit.
   * Confined to the row's own indent width, so it never reaches into the
   * toggle or label, which start right at that width's edge.
   */
  :host([indent-guides]) .row::before {
    content: "";
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    width: var(--jolly-tree-row-indent, 0px);
    background-image: repeating-linear-gradient(
      to right,
      var(--jolly-tree-guide-color, var(--jolly-border, ${kFallback.borderStrong})) 0,
      var(--jolly-tree-guide-color, var(--jolly-border, ${kFallback.borderStrong})) 1px,
      transparent 1px,
      transparent var(--jolly-tree-indent, 16px)
    );
    background-position: calc(var(--jolly-tree-indent, 16px) / 2) 0;
    pointer-events: none;
  }
`;
