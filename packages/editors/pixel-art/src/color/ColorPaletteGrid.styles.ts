// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { swatchFill } from "./swatchFill.styles.ts";

export const colorPaletteGridStyles = css`
  :host {
    display: block;
    flex: 0 1 auto;
    min-width: 43px;
    max-width: 100%;
    max-height: 112px;
    overflow: hidden auto;
    scroll-snap-type: y mandatory;
    scrollbar-width: thin;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, 20px);
    gap: 3px;
    width: calc((var(--palette-columns, 2) * 23px) - 3px);
    max-width: 100%;
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
    scroll-snap-align: start;

    ${swatchFill}
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

  button.in-range:not([aria-pressed="true"], :focus-visible)::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 2px var(--color-accent, #48f);
    pointer-events: none;
  }

  button.drop-target {
    outline: 2px dashed var(--color-accent, #48f);
    outline-offset: -2px;
  }

  button:disabled {
    cursor: default;
  }
`;
