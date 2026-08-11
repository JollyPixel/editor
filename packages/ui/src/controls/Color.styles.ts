// Import Third-party Dependencies
import { css } from "lit";

export const colorStyles = css`
  /* Fill the control so the colour sample has no surrounding frame. */
  .value .swatch {
    position: relative;
    flex: 0 0 auto;
    width: var(--jolly-control-height, 20px);
    height: var(--jolly-control-height, 20px);
    padding: 0;
    overflow: hidden;
    border: none;
    border-radius: var(--jolly-radius-sm, 2px);
    background: none;
    cursor: pointer;
    transition: filter var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  /* Avoid changing the sample fill for hover and focus states. */
  .value .swatch:hover:not(:disabled) {
    filter: brightness(1.12);
  }

  .value .swatch:focus-visible {
    outline: 2px solid var(--jolly-focus-ring);
    outline-offset: 1px;
  }

  /* Layer the colour over a checkerboard to reveal transparency. */
  .value .swatch-face {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    background-color: var(--jolly-surface-raised, Canvas);
    background-image:
      linear-gradient(
        var(--jolly-swatch-color, transparent),
        var(--jolly-swatch-color, transparent)
      ),
      conic-gradient(
        var(--jolly-swatch-checker) 25%,
        transparent 0 50%,
        var(--jolly-swatch-checker) 0 75%,
        transparent 0
      );
    background-size: auto, 6px 6px;
    pointer-events: none;
  }

  .value .swatch {
    --jolly-swatch-checker: color-mix(in oklab, var(--jolly-ink) 18%, transparent);
  }

  /* Preserve the swatch slot while hiding mixed values. */
  :host([mixed]) .value .swatch {
    background: var(--jolly-control-bg);
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

  /* Fixed positioning overrides centered UA styles for the top-layer popup. */
  .value .popover {
    position: fixed;
    inset: auto;
    width: max-content;
    margin: 0;
    padding: var(--jolly-space-1, 4px);
    overflow: visible;
    border: none;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-surface-raised, Canvas);
    box-shadow: var(--jolly-shadow-overlay);
    color: var(--jolly-text, CanvasText);
  }
`;
