// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import {
  fillTransition,
  truncate,
  visuallyHidden
} from "../theme/styles/mixins.ts";

export const buttonGroupStyles = css`
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

  :host([layout="tiles"]) .group {
    display: grid;
    grid-template-columns: repeat(
      auto-fit,
      minmax(var(--jolly-button-group-tile-size, 96px), 1fr)
    );
    gap: var(--jolly-space-1, 4px);
  }

  .segment {
    position: relative;
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

    ${fillTransition}
  }

  :host([layout="segmented"]) .segment:first-child {
    border-radius: var(--jolly-radius-sm, 2px) 0 0 var(--jolly-radius-sm, 2px);
  }

  :host([layout="segmented"]) .segment:last-child {
    border-radius: 0 var(--jolly-radius-sm, 2px) var(--jolly-radius-sm, 2px) 0;
  }

  :host([layout="segmented"]) .segment:only-child {
    border-radius: var(--jolly-radius-sm, 2px);
  }

  :host([layout="grid"]) .segment {
    border-radius: var(--jolly-radius-sm, 2px);
  }

  :host([layout="tiles"]) .segment {
    --jolly-icon-size: var(--jolly-button-group-tile-icon-size, 40px);

    flex-direction: column;
    gap: var(--jolly-space-1, 4px);
    height: auto;
    min-height: var(--jolly-button-group-tile-size, 96px);
    padding: var(--jolly-space-2, 8px);
    border-radius: var(--jolly-radius-md, 6px);
  }

  :host([layout="tiles"]) .segment-label {
    max-width: 100%;
    font-weight: 600;
  }

  .segment-caption {
    max-width: 100%;
    color: var(--jolly-text-muted);

    ${truncate}
  }

  .segment[aria-checked="true"] .segment-caption {
    color: inherit;
  }

  .segment:hover:not(:disabled) {
    --jolly-icon-tone-strength: var(--jolly-icon-tone-engaged, 100%);

    background: var(--jolly-control-bg-hover);
  }

  .segment:active:not(:disabled) {
    background: var(--jolly-control-bg-active);
  }

  .segment:focus-visible {
    background: var(--jolly-control-bg-focus);
    outline: none;
  }

  .segment[aria-checked="true"],
  .segment[aria-checked="true"]:hover:not(:disabled) {
    --jolly-icon-tone-strength: 0%;
  }

  .segment[aria-checked="true"] {
    background: var(--jolly-accent-fill);
    color: var(--jolly-text-on-fill);
  }

  .segment[aria-checked="true"]:hover:not(:disabled) {
    background: var(--jolly-accent-fill-hover);
  }

  .segment[aria-checked="true"]:focus-visible {
    background: var(--jolly-accent-fill-focus);
  }

  .segment:disabled {
    --jolly-icon-tone-strength: 0%;

    cursor: default;
    opacity: 0.5;
  }

  .segment-label {
    ${truncate}
  }

  :host([icon-only]) .segment-label {
    ${visuallyHidden}
  }
`;
