// Import Third-party Dependencies
import { css } from "lit";

export const colorPaletteGridStyles = css`
  :host {
    display: block;
    flex: 0 0 auto;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 20px);
    gap: 3px;
  }

  .grid button {
    position: relative;
    width: 20px;
    height: 20px;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--color-divider);
    border-radius: var(--color-swatch-radius, 4px);
    cursor: pointer;
    background: repeating-conic-gradient(#aaa 0% 25%, #eee 0% 50%)
      0 0 / 8px 8px;
  }

  .grid span {
    display: block;
    width: 100%;
    height: 100%;
  }

  .grid button:focus,
  .grid button:focus-visible {
    outline: 0;
  }

  button[aria-pressed="true"]::after,
  button:focus-visible::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px #fff, inset 0 0 0 2px #111;
    pointer-events: none;
  }

  button:focus-visible::after {
    box-shadow: inset 0 0 0 2px var(--color-accent, #48f),
      inset 0 0 0 3px #fff;
  }

  button:disabled {
    cursor: default;
  }

`;
