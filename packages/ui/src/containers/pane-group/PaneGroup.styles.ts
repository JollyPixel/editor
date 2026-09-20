// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../../theme/styles/fallbacks.ts";
import {
  focusRing,
  truncate
} from "../../theme/styles/mixins.ts";

export const paneGroupStyles = css`
  :host {
    display: flex;
    box-sizing: border-box;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-surface, ${kFallback.controlBg});
    color: var(--jolly-text, ${kFallback.text});
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
    pointer-events: auto;
  }

  .tabs {
    display: flex;
    flex: 0 0 auto;
    align-items: stretch;
    gap: 1px;
    min-height: calc(
      var(--jolly-row-height, 20px) + (2 * var(--jolly-space-1, 4px))
    );
    overflow: hidden;
    background: var(
      --jolly-pane-header-bg,
      ${kFallback.paneHeaderBg}
    );
    color: var(--jolly-text-on-fill, white);
    user-select: none;
  }

  .tab {
    position: relative;
    display: inline-flex;
    flex: 0 1 auto;
    align-items: center;
    justify-content: center;
    gap: var(--jolly-space-1, 4px);
    min-width: 0;
    padding: 0 var(--jolly-space-2, 8px);
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 600;
    letter-spacing: 0.08em;
    opacity: 0.7;
    cursor: pointer;
    touch-action: none;
  }

  .tab jolly-icon {
    --jolly-icon-size: 14px;
  }

  .label {
    min-width: 0;

    ${truncate}
  }

  .tab:hover {
    --jolly-icon-tone-strength: var(--jolly-icon-tone-engaged, 100%);

    background: rgb(255 255 255 / 10%);
    opacity: 1;
  }

  .tab[aria-selected="true"] {
    --jolly-icon-tone-strength: 0%;

    background: rgb(255 255 255 / 18%);
    opacity: 1;
  }

  .tab[aria-selected="true"]::after {
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    height: 2px;
    background: currentcolor;
    content: "";
  }

  .tab:disabled {
    background: transparent;
    opacity: 0.35;
    cursor: not-allowed;
  }

  .tab[data-grabbed] {
    background: rgb(255 255 255 / 30%);
  }

  .tab[data-dragging] {
    opacity: 0.4;
  }

  .tab:focus-visible {
    ${focusRing}
    outline-offset: -2px;
  }

  .panels {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  ::slotted(jolly-pane) {
    flex: 1 1 auto;
    min-height: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
`;
