// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import {
  fillTransition,
  focusRing,
  overlayMotion,
  truncate
} from "../theme/styles/mixins.ts";

export const selectGridStyles = css`
  .value .popover {
    position: fixed;
    inset: auto;
    width: max-content;
    max-height: min(480px, 80vh);
    margin: 0;
    padding: var(--jolly-space-1, 4px);
    overflow: auto;
    border: none;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-surface-raised, Canvas);
    box-shadow: var(--jolly-shadow-overlay);
    color: var(--jolly-text, CanvasText);
  }

  .listbox {
    display: flex;
    flex-direction: column;
    gap: var(--jolly-space-1, 4px);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .group-label {
    padding-inline: var(--jolly-space-1, 4px);
    color: var(--jolly-text-muted);
    font-size: calc(var(--jolly-font-size, 11px) - 1px);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(
      var(--jolly-select-columns),
      minmax(var(--jolly-select-tile-size, 40px), max-content)
    );
    gap: 2px;
  }

  .tile {
    --jolly-icon-size: calc(var(--jolly-select-tile-size, 40px) - 8px);

    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--jolly-select-tile-size, 40px);
    height: var(--jolly-select-tile-size, 40px);
    padding: 0 var(--jolly-space-1, 4px);
    border: 0;
    border-radius: var(--jolly-radius-sm, 2px);
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;

    ${fillTransition}
  }

  .tile[data-active]:not(:disabled) {
    background: var(--jolly-control-bg-hover);
  }

  .tile[aria-selected="true"] {
    background: var(--jolly-control-bg-focus);
    box-shadow: inset 0 0 0 1px var(--jolly-accent-fill);
  }

  .tile:focus-visible {
    ${focusRing}
    outline-offset: -2px;
  }

  .tile:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .tile-label {
    ${truncate}
  }

  .caption {
    min-height: 1lh;
    margin-block-start: var(--jolly-space-1, 4px);
    padding-inline: var(--jolly-space-1, 4px);
    color: var(--jolly-text-muted);
    text-align: center;

    ${truncate}
  }

  ${overlayMotion}
`;
