// Import Third-party Dependencies
import { css } from "lit";

/**
 * Paint the swatch on a span because Chromium preserves native color-input borders.
 */
export const colorStyles = css`
  .value .swatch {
    position: relative;
    flex: 0 0 auto;
    width: var(--jolly-control-height, 22px);
    height: var(--jolly-control-height, 22px);
    overflow: hidden;
    border-radius: var(--jolly-radius-sm, 3px);
    cursor: pointer;
  }

  .value .swatch-face {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .value .swatch-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    background: none;
    opacity: 0;
    cursor: pointer;
  }

  /*
   * Mixed values hide the swatch.
   */
  :host([mixed]) .value .swatch {
    opacity: 0.35;
    pointer-events: none;
  }

  .value input.hex {
    flex: 1 1 auto;
    min-width: 7ch;
    font-variant-numeric: inherit;
  }

  :host([disabled]) .value .swatch {
    cursor: default;
  }
`;
