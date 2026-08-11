// Import Third-party Dependencies
import { css } from "lit";

export const sliderStyles = css`
  /*
   * Override native range track and thumb rendering.
   */
  .value input[type="range"] {
    flex: 1 1 auto;
    min-width: 0;
    height: var(--jolly-control-height, 22px);
    padding: 0;
    border: none;
    background: none;
    appearance: none;
    cursor: pointer;
  }

  .value input[type="range"]::-webkit-slider-runnable-track {
    height: 3px;
    border-radius: var(--jolly-radius-sm, 3px);
    background: var(--jolly-border-strong);
  }

  .value input[type="range"]::-moz-range-track {
    height: 3px;
    border-radius: var(--jolly-radius-sm, 3px);
    background: var(--jolly-border-strong);
  }

  /*
   * Center the 14px thumb on the 3px track.
   */
  .value input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 10px;
    height: 14px;
    margin-top: -5.5px;
    border-radius: var(--jolly-radius-sm, 3px);
    background: var(--jolly-accent-fill);
  }

  .value input[type="range"]::-moz-range-thumb {
    width: 10px;
    height: 14px;
    border: none;
    border-radius: var(--jolly-radius-sm, 3px);
    background: var(--jolly-accent-fill);
  }

  /*
   * Mixed values have no thumb position.
   */
  :host([mixed]) .value input[type="range"] {
    opacity: 0.35;
    pointer-events: none;
  }

  .readout {
    flex: 0 0 auto;
    min-width: 3.5ch;
    color: var(--jolly-text);
    text-align: right;
    font-variant-numeric: inherit;
  }

  :host([disabled]) .value input[type="range"] {
    cursor: default;
  }
`;
