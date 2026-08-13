// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/styles/fallbacks.ts";

export const buttonStyles = css`
  :host {
    display: inline-flex;
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--jolly-space-1, 4px);
    width: 100%;
    height: var(--jolly-control-height, 20px);
    padding: 0 var(--jolly-space-2, 8px);
    border: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg, ${kFallback.controlBg});
    color: var(--jolly-text, ${kFallback.text});
    font: inherit;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  button:hover:not(:disabled) {
    background: var(--jolly-control-bg-hover);
  }

  button:active:not(:disabled) {
    background: var(--jolly-control-bg-active);
  }

  /* Focus is a fill step, which has to beat hover because they share a channel. */
  button:focus-visible {
    background: var(--jolly-control-bg-focus);
    outline: none;
  }

  :host([variant="accent"]) button {
    background: var(--jolly-accent-fill);
    color: var(--jolly-text-on-fill);
  }

  :host([variant="accent"]) button:hover:not(:disabled) {
    background: var(--jolly-accent-fill-hover);
  }

  :host([variant="accent"]) button:focus-visible,
  :host([variant="accent"]) button:active:not(:disabled) {
    background: var(--jolly-accent-fill-focus);
  }

  :host([variant="danger"]) button {
    background: var(--jolly-invalid-bg);
    color: var(--jolly-danger);
  }

  :host([variant="danger"]) button:hover:not(:disabled) {
    background: var(--jolly-invalid-bg-hover);
  }

  :host([variant="danger"]) button:focus-visible,
  :host([variant="danger"]) button:active:not(:disabled) {
    background: var(--jolly-invalid-bg-focus);
  }

  :host([disabled]) button {
    opacity: 0.5;
    cursor: default;
  }

  /*
   * Icon-only buttons use a square target.
   */
  :host([icon-only]) button {
    width: var(--jolly-icon-button-size, 32px);
    padding: 0;
  }
`;
