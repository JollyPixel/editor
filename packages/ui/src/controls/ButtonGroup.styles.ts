// Import Third-party Dependencies
import { css } from "lit";

export const buttonGroupStyles = css`
  .group {
    display: flex;
    flex: 1 1 auto;
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
    height: var(--jolly-control-height, 22px);
    padding: 0 var(--jolly-space-1, 4px);
    border: 1px solid var(--jolly-border-strong);
    background: var(--jolly-control-bg);
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  /*
   * Round only the outer edges of joined segments.
   */
  :host(:not([layout="grid"])) .segment + .segment {
    border-left: none;
  }

  :host(:not([layout="grid"])) .segment:first-child {
    border-radius: var(--jolly-radius-sm, 3px) 0 0 var(--jolly-radius-sm, 3px);
  }

  :host(:not([layout="grid"])) .segment:last-child {
    border-radius: 0 var(--jolly-radius-sm, 3px) var(--jolly-radius-sm, 3px) 0;
  }

  :host([layout="grid"]) .segment {
    border-radius: var(--jolly-radius-sm, 3px);
  }

  .segment:hover:not(:disabled) {
    background: var(--jolly-control-bg-hover);
  }

  .segment:active:not(:disabled) {
    background: var(--jolly-control-bg-active);
  }

  .segment[aria-checked="true"] {
    background: var(--jolly-accent-fill);
    color: var(--jolly-text-on-fill);
  }

  .segment:focus-visible {
    outline: 2px solid var(--jolly-focus-ring);
    outline-offset: 2px;
    /*
     * Keep the focus outline above adjacent segments.
     */
    z-index: 1;
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
