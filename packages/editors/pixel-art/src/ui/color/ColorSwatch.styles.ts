// Import Third-party Dependencies
import { css } from "lit";

export const colorSwatchStyles = css`
  :host {
    display: inline-flex;
  }

  button {
    width: 26px;
    height: 26px;
    border: none;
    border-radius: var(--color-swatch-radius, 4px);
    cursor: pointer;
    padding: 0;
    background: #000000;
    box-sizing: border-box;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      inset 0 -1px 0 rgba(0, 0, 0, 0.2),
      0 0 3px 0 var(--color-swatch-edge, transparent),
      0 1px 2px rgba(0, 0, 0, 0.25);
  }

  button:focus-visible {
    outline: 2px solid var(--color-swatch-focus-color, var(--color-accent, #4488ff));
    outline-offset: 2px;
  }

  .popover {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: var(--jolly-space-1, 4px);
    overflow: visible;
    border: none;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-surface-raised, Canvas);
    box-shadow: var(--jolly-shadow-overlay);
    color: var(--jolly-text, CanvasText);
    font-family: var(--jolly-font-family, ui-monospace, monospace);
  }
`;
