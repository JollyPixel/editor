// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { truncate } from "../theme/styles/mixins.ts";

export const selectStyles = css`
  .value .select-wrap {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
  }

  /*
   * Replace native chrome with the shared field styling and chevron.
   */
  .value select {
    flex: 1 1 auto;
    min-width: 0;
    appearance: none;
    padding-inline-end: calc(var(--jolly-space-1, 4px) * 2 + 12px);
    cursor: pointer;
  }

  /* Native dropdown rows need an opaque themed plane, especially in dark mode. */
  .value option {
    background: var(--jolly-surface-raised, Canvas);
    color: var(--jolly-text, CanvasText);
  }

  /*
   * Hide Firefox's inner focus ring without hiding the selected value.
   */
  .value select:-moz-focusring {
    color: transparent;
    text-shadow: 0 0 0 currentcolor;
  }

  .value .chevron {
    position: absolute;
    top: 50%;
    right: var(--jolly-space-1, 4px);
    width: 10px;
    height: 10px;
    color: var(--jolly-text-muted);
    transform: translateY(-50%) rotate(90deg);
    pointer-events: none;
  }

  :host([disabled]) .value select {
    cursor: default;
  }

  .value .trigger {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    padding-inline-end: calc(var(--jolly-space-1, 4px) * 2 + 12px);
    text-align: start;
    cursor: pointer;
  }

  .value .trigger[aria-expanded="true"] {
    background: var(--jolly-control-bg-focus);
  }

  :host([disabled]) .value .trigger {
    cursor: default;
  }

  .value .trigger-icon {
    --jolly-icon-size: 16px;
  }

  .value .trigger-label {
    flex: 1 1 auto;
    min-width: 0;

    ${truncate}
  }
`;
