// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/fallbacks.ts";

export const buttonStyles = css`
  :host {
    display: inline-flex;
    font-family: var(--jolly-font-family, system-ui, sans-serif);
    font-size: var(--jolly-font-size, 12px);
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--jolly-space-1, 4px);
    width: 100%;
    height: var(--jolly-control-height, 22px);
    padding: 0 var(--jolly-space-2, 8px);
    border: 1px solid var(--jolly-border-strong, ${kFallback.borderStrong});
    border-radius: var(--jolly-radius-sm, 3px);
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

  button:focus-visible {
    outline: 2px solid var(--jolly-focus-ring, ${kFallback.focusRing});
    outline-offset: 2px;
  }

  :host([variant="accent"]) button {
    border-color: transparent;
    background: var(--jolly-accent-fill);
    color: var(--jolly-text-on-fill);
  }

  :host([variant="danger"]) button {
    border-color: var(--jolly-danger-border);
    color: var(--jolly-danger);
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
