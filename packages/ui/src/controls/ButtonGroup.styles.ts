// Import Third-party Dependencies
import { css } from "lit";

export const buttonGroupStyles = css`
  /*
   * Segments used to be joined by shared borders. Without them a hairline gap
   * does the same job: the fills read as one strip, still visibly divided.
   */
  .group {
    display: flex;
    flex: 1 1 auto;
    gap: 1px;
    min-width: 0;
  }

  :host([layout="grid"]) .group {
    display: grid;
    gap: var(--jolly-space-1, 4px);
  }

  .segment {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 0;
    gap: 4px;
    min-width: 0;
    height: var(--jolly-control-height, 20px);
    padding: 0 var(--jolly-space-1, 4px);
    border: 0;
    background: var(--jolly-control-bg);
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  /*
   * Round only the outer edges of joined segments.
   */
  :host(:not([layout="grid"])) .segment:first-child {
    border-radius: var(--jolly-radius-sm, 2px) 0 0 var(--jolly-radius-sm, 2px);
  }

  :host(:not([layout="grid"])) .segment:last-child {
    border-radius: 0 var(--jolly-radius-sm, 2px) var(--jolly-radius-sm, 2px) 0;
  }

  :host(:not([layout="grid"])) .segment:only-child {
    border-radius: var(--jolly-radius-sm, 2px);
  }

  :host([layout="grid"]) .segment {
    border-radius: var(--jolly-radius-sm, 2px);
  }

  .segment:hover:not(:disabled) {
    background: var(--jolly-control-bg-hover);
  }

  .segment:active:not(:disabled) {
    background: var(--jolly-control-bg-active);
  }

  .segment:focus-visible {
    background: var(--jolly-control-bg-focus);
    outline: none;
  }

  .segment[aria-checked="true"] {
    background: var(--jolly-accent-fill);
    color: var(--jolly-text-on-fill);
  }

  .segment[aria-checked="true"]:hover:not(:disabled) {
    background: var(--jolly-accent-fill-hover);
  }

  /*
   * A checked segment is already filled, so its focus step lightens the accent
   * rather than tinting over it.
   */
  .segment[aria-checked="true"]:focus-visible {
    background: var(--jolly-accent-fill-focus);
  }

  .segment:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .segment-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /*
   * Hide visible labels while keeping their accessible names.
   */
  :host([icons-only]) .segment-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`;
