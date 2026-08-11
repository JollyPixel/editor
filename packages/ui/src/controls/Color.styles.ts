// Import Third-party Dependencies
import { css } from "lit";

/**
 * Paint the swatch on a span because Chromium preserves native color-input borders.
 */
export const colorStyles = css`
  /*
   * The face is inset so the swatch's own fill shows as a frame around it,
   * which is what carries hover and focus for a control that is otherwise a
   * solid block of the user's colour.
   */
  .value .swatch {
    position: relative;
    flex: 0 0 auto;
    width: var(--jolly-control-height, 20px);
    height: var(--jolly-control-height, 20px);
    overflow: hidden;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg);
    cursor: pointer;
    transition: background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .value .swatch:hover {
    background: var(--jolly-control-bg-hover);
  }

  .value .swatch:has(input:focus-visible) {
    background: var(--jolly-control-bg-focus);
  }

  .value .swatch-face {
    display: block;
    width: calc(100% - 4px);
    height: calc(100% - 4px);
    margin: 2px;
    border-radius: 1px;
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
