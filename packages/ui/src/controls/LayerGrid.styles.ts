// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { fillTransition } from "../theme/styles/mixins.ts";

export const layerGridStyles = css`
  .grid {
    --jolly-layer-grid-cell: calc(var(--jolly-control-height, 20px) * 0.8);

    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    gap: var(--jolly-space-1, 4px);
    min-width: 0;
    padding: 2px 0;
    touch-action: none;
  }

  .block {
    display: grid;
    flex: 1 1 0;
    grid-template-columns: repeat(var(--jolly-layer-grid-columns), minmax(0, 1fr));
    grid-auto-rows: var(--jolly-layer-grid-cell);
    gap: 1px;
    min-width: calc(var(--jolly-layer-grid-columns) * var(--jolly-layer-grid-cell));
    overflow: hidden;
    border-radius: var(--jolly-radius-sm, 2px);
  }

  .cell {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    background: var(--jolly-control-bg);
    font-variant-numeric: var(--jolly-font-numeric, tabular-nums);
    font-size: calc(var(--jolly-font-size, 11px) - 1px);
    cursor: pointer;
    user-select: none;

    ${fillTransition}
  }

  .cell:hover {
    background: var(--jolly-control-bg-hover);
  }

  .cell:focus-visible {
    background: var(--jolly-control-bg-focus);
    outline: none;
  }

  .cell[aria-checked="true"] {
    background: var(--jolly-accent-fill);
    color: var(--jolly-text-on-fill);
  }

  .cell[aria-checked="true"]:hover {
    background: var(--jolly-accent-fill-hover);
  }

  .cell[aria-checked="true"]:focus-visible {
    background: var(--jolly-accent-fill-focus);
  }

  .cell[aria-checked="mixed"] {
    color: var(--jolly-text-muted);
  }

  :host([invalid]) .cell:not([aria-checked="true"]) {
    background: var(--jolly-invalid-bg);
  }

  :host([readonly]) .cell:not([aria-checked="true"]),
  :host([locked]) .cell:not([aria-checked="true"]) {
    background: var(--jolly-control-bg-muted);
  }

  :host([readonly]) .cell,
  :host([locked]) .cell {
    cursor: default;
  }

  :host([disabled]) .cell {
    cursor: default;
    opacity: 0.5;
  }
`;
