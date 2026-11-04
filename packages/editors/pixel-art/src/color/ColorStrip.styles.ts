// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { swatchFill } from "./swatchFill.styles.ts";

export const colorStripStyles = css`
  :host {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .label {
    display: var(--color-strip-label-display, block);
    color: var(--color-text-muted);
  }

  .swatches {
    display: flex;
    gap: 2px;
    min-width: 0;
    min-height: 10px;
  }

  button {
    position: relative;
    flex: 0 1 auto;
    width: 16px;
    min-width: 10px;
    aspect-ratio: 1;
    padding: 0;
    border: 1px solid var(--color-divider);
    border-radius: var(--color-swatch-radius, 4px);
    cursor: pointer;

    ${swatchFill}
  }

  button[aria-current="true"] {
    box-shadow: 0 0 0 1px var(--color-text);
  }

  button:focus-visible {
    outline: 2px solid var(--color-accent, #48f);
    outline-offset: 1px;
  }
`;
