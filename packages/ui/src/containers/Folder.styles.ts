// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/styles/fallbacks.ts";
import {
  fillTransition,
  truncate
} from "../theme/styles/mixins.ts";

export const folderStyles = css`
  :host {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: var(--jolly-row-gap, 4px);
    min-width: 0;
    margin-block-end: var(--jolly-folder-gap, 2px);
    color: var(--jolly-text, ${kFallback.text});
    font: inherit;
  }

  .header {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    min-height: var(--jolly-row-height, 20px);
    overflow: hidden;
    padding-inline: var(--jolly-space-1, 4px);
    border: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(
      --jolly-folder-header-bg,
      ${kFallback.folderHeaderBg}
    );
    color: inherit;
    font: inherit;
    ${fillTransition}
  }

  .header::after {
    position: absolute;
    z-index: 0;
    inset-block: 0;
    inset-inline-end: 0;
    width: 46%;
    background: conic-gradient(
        from 90deg,
        currentColor 25%,
        transparent 0 50%,
        currentColor 0 75%,
        transparent 0
      )
      0 / 8px 8px;
    color: var(--jolly-accent-text, ${kFallback.focusRing});
    content: "";
    opacity: 0.08;
    pointer-events: none;
    -webkit-mask-image: linear-gradient(to right, transparent, black 55%);
    mask-image: linear-gradient(to right, transparent, black 55%);
    transition: opacity var(--jolly-duration-fast, 100ms)
      var(--jolly-easing, ease);
  }

  .header:hover,
  .header:focus-within {
    background: var(
      --jolly-folder-header-bg-hover,
      ${kFallback.folderHeaderBgHover}
    );
  }

  .header:hover::after,
  .header:focus-within::after {
    opacity: 0.14;
  }

  .toggle,
  .title {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    align-self: stretch;
    min-width: 0;
    gap: var(--jolly-space-1, 4px);
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
  }

  .toggle {
    cursor: pointer;
  }

  .toggle .label,
  .title .label {
    min-width: 0;
    ${truncate}
  }

  ::slotted([slot="actions"]) {
    position: relative;
    z-index: 1;
    flex: 0 0 auto;
    margin-block: var(--jolly-space-1, 4px);
  }

  ::slotted(jolly-button[slot="actions"]) {
    --jolly-text: var(
      --jolly-folder-action-fg,
      ${kFallback.folderActionFg}
    );
    --jolly-control-bg: var(
      --jolly-folder-action-bg,
      ${kFallback.folderActionBg}
    );
    --jolly-control-bg-hover: var(--jolly-folder-action-bg-hover);
    --jolly-control-bg-focus: var(--jolly-folder-action-bg-focus);
    --jolly-control-bg-active: var(--jolly-folder-action-bg-active);
  }

  /*
   * The danger variant paints itself from its own tokens, so it has to be
   * inverted on its own: a filled red ground, the glyph in the action
   * foreground.
   */
  ::slotted(jolly-button[slot="actions"][variant="danger"]) {
    --jolly-danger: var(
      --jolly-folder-action-danger-fg,
      ${kFallback.folderActionDangerFg}
    );
    --jolly-invalid-bg: var(
      --jolly-folder-action-danger-bg,
      ${kFallback.folderActionDangerBg}
    );
    --jolly-invalid-bg-hover: var(--jolly-folder-action-danger-bg-hover);
    --jolly-invalid-bg-focus: var(--jolly-folder-action-danger-bg-focus);
  }

  /*
   * The gutter holds the chevron's place in a folder that has none, so a
   * header that cannot collapse still lines its label up with its neighbours.
   */
  .toggle .chevron,
  .title .gutter {
    flex: 0 0 auto;
    width: 10px;
    height: 10px;
  }

  .toggle .chevron {
    color: var(--jolly-text-muted, ${kFallback.text});
    transform-origin: center;
    transition: transform var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  :host([open]) .toggle .chevron {
    transform: rotate(90deg);
  }

  .grip {
    position: relative;
    z-index: 1;
    display: none;
    width: var(--jolly-control-height, 20px);
    height: var(--jolly-control-height, 20px);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--jolly-text-muted, ${kFallback.text});
    cursor: grab;
  }

  .grip jolly-icon {
    width: 12px;
    height: 12px;
  }

  :host([reorderable]) .grip {
    display: inline-grid;
    place-items: center;
  }

  .grip {
    touch-action: none;
  }

  :host([dragging]) {
    opacity: 0.4;
  }

  button:focus-visible {
    outline: none;
    background: var(--jolly-control-bg-focus);
  }

  .content {
    display: none;
    flex-direction: column;
    gap: var(--jolly-row-gap, 4px);
    padding-inline-start: var(
      --jolly-folder-indent,
      var(--jolly-space-1, 4px)
    );
  }

  :host([flush]) .content {
    padding-inline-start: 0;
  }

  /*
   * The content takes any height the host is given, so a folder stretched by
   * its owner hands that height down to a filling child.
   */
  :host([open]) .content {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
  }

  @media (forced-colors: active) {
    .header::after {
      display: none;
    }
  }
`;
