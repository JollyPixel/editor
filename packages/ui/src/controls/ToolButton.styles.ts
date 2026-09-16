// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/styles/fallbacks.ts";

export const toolButtonStyles = css`
  :host {
    --jolly-tool-button-size: 36px;
    --jolly-tool-button-gap: 6px;

    position: relative;
    display: inline-flex;
    flex: 0 0 auto;
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
  }

  .button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: var(--jolly-tool-button-size);
    height: var(--jolly-tool-button-size);
    padding: 0;
    border: 0;
    border-radius: var(--jolly-radius-md, 6px);
    background: transparent;
    color: var(--jolly-text-muted, ${kFallback.text});
    font: inherit;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .button jolly-icon {
    --jolly-icon-size: 20px;
  }

  .button:hover:not(:disabled),
  :host([open]) .button {
    color: var(--jolly-text, ${kFallback.text});
    background: var(--jolly-control-bg-hover);
  }

  .button:focus-visible {
    outline: 1px solid var(--jolly-accent-fill);
    outline-offset: -1px;
  }

  :host([active]) .button,
  :host([active]) .button:hover:not(:disabled) {
    background: var(--jolly-accent-fill);
    color: var(--jolly-text-on-fill);
  }

  .button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .notch {
    position: absolute;
    width: 0;
    height: 0;
    border-style: solid;
    border-color: transparent;
    opacity: 0.7;
  }

  :host([flyout-side="above"]) .notch {
    top: 3px;
    left: 50%;
    border-width: 0 3px 4px;
    transform: translateX(-50%);
    border-bottom-color: currentcolor;
  }

  :host([flyout-side="below"]) .notch {
    bottom: 3px;
    left: 50%;
    border-width: 4px 3px 0;
    transform: translateX(-50%);
    border-top-color: currentcolor;
  }

  :host([flyout-side="right"]) .notch {
    top: 50%;
    right: 3px;
    border-width: 3px 0 3px 4px;
    transform: translateY(-50%);
    border-left-color: currentcolor;
  }

  :host([flyout-side="left"]) .notch {
    top: 50%;
    left: 3px;
    border-width: 3px 4px 3px 0;
    transform: translateY(-50%);
    border-right-color: currentcolor;
  }

  .tooltip,
  .flyout {
    position: absolute;
    z-index: 10;
  }

  .tooltip {
    padding: 3px 8px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-surface-raised);
    box-shadow: var(--jolly-shadow-overlay);
    color: var(--jolly-text);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  :host(:not([open])) .button:hover + .tooltip {
    opacity: 1;
    visibility: visible;
  }

  .flyout {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-surface-raised);
    box-shadow: var(--jolly-shadow-floating);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .flyout[hidden] {
    display: none;
  }

  :host([open]) .flyout {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  .flyout::before {
    content: "";
    position: absolute;
  }

  :host([flyout-side="above"]) .flyout,
  :host([flyout-side="below"]) .flyout {
    flex-direction: column;
  }

  :host([flyout-side="above"]) .flyout,
  :host([flyout-side="above"]) .tooltip {
    bottom: calc(100% + var(--jolly-tool-button-gap));
    left: 50%;
    transform: translateX(-50%);
  }

  :host([flyout-side="below"]) .flyout,
  :host([flyout-side="below"]) .tooltip {
    top: calc(100% + var(--jolly-tool-button-gap));
    left: 50%;
    transform: translateX(-50%);
  }

  :host([flyout-side="right"]) .flyout,
  :host([flyout-side="right"]) .tooltip {
    left: calc(100% + var(--jolly-tool-button-gap));
    top: 50%;
    transform: translateY(-50%);
  }

  :host([flyout-side="left"]) .flyout,
  :host([flyout-side="left"]) .tooltip {
    right: calc(100% + var(--jolly-tool-button-gap));
    top: 50%;
    transform: translateY(-50%);
  }

  :host([flyout-side="above"]) .flyout::before {
    inset: 100% 0 auto;
    height: var(--jolly-tool-button-gap);
  }

  :host([flyout-side="below"]) .flyout::before {
    inset: auto 0 100%;
    height: var(--jolly-tool-button-gap);
  }

  :host([flyout-side="right"]) .flyout::before {
    inset: 0 100% 0 auto;
    width: var(--jolly-tool-button-gap);
  }

  :host([flyout-side="left"]) .flyout::before {
    inset: 0 auto 0 100%;
    width: var(--jolly-tool-button-gap);
  }
`;
