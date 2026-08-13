// Import Third-party Dependencies
import { css } from "lit";

export const graphStyles = css`
  :host {
    display: block;
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
  }

  :host([disabled]) {
    opacity: 0.5;
  }

  .wrap {
    display: flex;
    flex-direction: column;
    gap: calc(var(--jolly-space-1, 4px) / 2);
  }

  .label {
    color: var(--jolly-text-muted);
  }

  .canvas-wrap {
    position: relative;
  }

  canvas {
    display: block;
    width: 100%;
    height: calc(var(--jolly-row-height, 20px) * var(--jolly-graph-rows, 3));
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg);
  }

  .value {
    position: absolute;
    top: 2px;
    right: 4px;
    color: var(--jolly-text);
    font-variant-numeric: var(--jolly-font-numeric, tabular-nums);
    text-shadow: 0 1px 2px var(--jolly-surface, transparent);
    pointer-events: none;
  }
`;
