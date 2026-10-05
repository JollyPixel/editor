// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import {
  focusRing,
  overlayMotion
} from "../theme/styles/mixins.ts";

export const descriptionHintStyles = css`
  .hint {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    margin-inline-end: 2px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--jolly-accent-text);
    cursor: help;
  }

  .hint:hover {
    color: var(--jolly-text);
  }

  .hint:focus-visible {
    ${focusRing}
    outline-offset: 1px;
  }

  .hint > jolly-icon {
    width: 14px;
    height: 14px;
  }

  .hint-tooltip {
    position: fixed;
    inset: auto;
    box-sizing: border-box;
    width: max-content;
    max-inline-size: min(20rem, calc(100vw - 2rem));
    margin: 0;
    padding: 4px 6px;
    border: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-surface-raised);
    box-shadow: var(--jolly-shadow-overlay);
    color: var(--jolly-text);
    font: inherit;
    font-size: 0.9em;
    line-height: 1.4;
    text-align: start;
    white-space: normal;
  }

  ${overlayMotion}

  @media (forced-colors: active) {
    .hint-tooltip {
      border: 1px solid CanvasText;
      background: Canvas;
    }
  }
`;
