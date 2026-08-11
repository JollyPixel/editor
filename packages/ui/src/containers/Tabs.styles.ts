// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/fallbacks.ts";

export const tabsStyles = css`
  :host {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    color: var(--jolly-text, ${kFallback.text});
    font: inherit;
  }

  :host([orientation="vertical"]) {
    flex-direction: row;
  }

  /*
   * Tabs sit inside a plane, so the strip paints no surface. The selected tab's
   * accent edge is what marks the boundary the divider used to draw.
   */
  .list {
    display: flex;
    flex: 0 0 auto;
    gap: 1px;
  }

  :host([orientation="vertical"]) .list {
    flex-direction: column;
  }

  button {
    position: relative;
    min-height: var(--jolly-control-height, 20px);
    padding: 0 var(--jolly-space-2, 8px);
    border: 0;
    border-bottom: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition:
      background-color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      color var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  button::after {
    position: absolute;
    right: var(--jolly-space-2, 8px);
    bottom: 0;
    left: var(--jolly-space-2, 8px);
    height: 2px;
    background: transparent;
    content: "";
  }

  button:hover:not(:disabled) {
    background: var(--jolly-control-bg-hover, ${kFallback.controlBg});
  }

  button[aria-selected="true"] {
    background: var(--jolly-control-bg, ${kFallback.controlBg});
  }

  button[aria-selected="true"] {
    color: var(--jolly-accent-text);
  }

  button[aria-selected="true"]::after {
    background: var(--jolly-accent-fill);
  }

  :host([orientation="vertical"]) button::after {
    top: var(--jolly-space-1, 4px);
    right: 0;
    bottom: var(--jolly-space-1, 4px);
    left: auto;
    width: 2px;
    height: auto;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  button:focus-visible {
    background: var(--jolly-control-bg-focus, ${kFallback.controlBg});
    outline: none;
  }

  .panels {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
  }
`;
