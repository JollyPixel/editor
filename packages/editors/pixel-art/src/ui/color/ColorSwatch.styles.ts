// Import Third-party Dependencies
import { css } from "lit";

export const colorSwatchStyles = css`
  :host {
    display: inline-flex;
  }

  button {
    width: 26px;
    height: 26px;
    border: 2px solid var(--color-swatch-border, var(--color-border, #556067));
    border-radius: var(--color-swatch-radius, 4px);
    cursor: pointer;
    padding: 0;
    background: #000000;
    box-sizing: border-box;
  }

  button:focus-visible {
    outline: 2px solid var(--color-swatch-focus-color, var(--color-accent, #4488ff));
    outline-offset: 2px;
  }
`;
