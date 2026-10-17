// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/styles/fallbacks.ts";
import {
  fillTransition,
  focusRing
} from "../theme/styles/mixins.ts";

export const searchStyles = css`
  :host {
    display: flex;
    min-width: 0;
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
  }

  :host([compact]:not([expanded])) {
    display: inline-flex;
  }

  .box {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    gap: var(--jolly-space-1, 4px);
    min-width: 0;
    height: var(--jolly-control-height, 20px);
    padding-inline: var(--jolly-space-1, 4px) 2px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(
      --jolly-search-bg,
      var(--jolly-control-bg, ${kFallback.controlBg})
    );
    color: var(--jolly-text, ${kFallback.text});

    ${fillTransition}
  }

  .box:hover {
    background: var(
      --jolly-search-bg-hover,
      var(--jolly-control-bg-hover)
    );
  }

  .box:focus-within {
    background: var(
      --jolly-search-bg-focus,
      var(--jolly-control-bg-focus)
    );
  }

  .glyph {
    flex: 0 0 auto;
    opacity: 0.7;

    --jolly-icon-size: 12px;
  }

  input {
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    outline: none;
  }

  input::placeholder {
    color: var(--jolly-text-muted, ${kFallback.text});
    opacity: 1;
  }

  .trigger,
  .clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    padding: 0;
    border: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    color: inherit;
    cursor: pointer;

    ${fillTransition}
  }

  .trigger {
    width: var(--jolly-search-trigger-width, 16px);
    height: var(--jolly-search-trigger-height, 16px);
    background: var(--jolly-search-trigger-bg, none);
    opacity: var(--jolly-search-trigger-opacity, 0.75);
  }

  .clear {
    width: 16px;
    height: 16px;
    background: none;
    opacity: 0.75;
  }

  .clear[hidden] {
    display: none;
  }

  .trigger jolly-icon {
    --jolly-icon-size: var(--jolly-search-trigger-icon-size, 12px);
  }

  .clear jolly-icon {
    --jolly-icon-size: 12px;
  }

  .trigger:hover,
  .clear:hover {
    background: var(
      --jolly-search-trigger-bg-hover,
      var(--jolly-control-bg-hover)
    );
    opacity: 1;
  }

  .trigger:focus-visible {
    ${focusRing}
    outline-offset: 1px;
  }

  :host([disabled]) {
    opacity: 0.5;
    pointer-events: none;
  }
`;
