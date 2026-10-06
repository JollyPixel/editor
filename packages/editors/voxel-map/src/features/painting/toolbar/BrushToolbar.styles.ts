// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { viewportToolbarStyles } from "../../../shared/styles/viewportToolbar.styles.ts";

export const brushToolbarStyles = [viewportToolbarStyles, css`
  :host {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .notice {
    --jolly-icon-size: 12px;
    --jolly-surface: var(--jolly-intent-warning-fill);

    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-surface);
    box-shadow: var(--jolly-shadow-floating);
    color: var(--jolly-text-on-fill);
    font-size: 11px;
    line-height: 16px;
    white-space: nowrap;
  }

  .notice button {
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .notice button:focus-visible {
    outline: 1px solid currentcolor;
    outline-offset: 1px;
  }

  :host([disabled]) .brush {
    opacity: 0.6;
  }

  jolly-tool-button[slot="flyout"] {
    --jolly-tool-button-gap: 8px;
  }

  .step-count {
    position: absolute;
    right: 0;
    bottom: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    border-radius: 7px;
    background: var(--jolly-tone-teal);
    color: var(--jolly-surface-raised);
    font-size: 9px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    pointer-events: none;
  }

  .step-count > span {
    text-box: trim-both cap alphabetic;
  }

  .size {
    min-width: 2ch;
    font-weight: 600;
    text-align: center;
  }

  .axis {
    display: inline-flex;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
`];
