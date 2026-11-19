// Import Third-party Dependencies
import { css } from "lit";

export const spatialPadStyles = css`
  :host {
    display: block;
    color: var(--jolly-text);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--jolly-space-2);
    padding-inline-end: var(--jolly-space-2);
  }

  .pad {
    display: block;
    box-sizing: border-box;
    inline-size: 100%;
    aspect-ratio: 1 / 1;
    border: 1px solid var(--jolly-divider);
    border-radius: var(--jolly-radius-md, 4px);
    background: var(--jolly-surface);
    cursor: crosshair;
    touch-action: none;
  }

  .pad:focus {
    outline: none;
  }

  .heat-stop {
    stop-color: var(--jolly-sky-400);
  }

  .ring {
    fill: none;
    stroke: var(--jolly-text-muted);
    stroke-dasharray: 3 3;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .ring.full {
    stroke: var(--jolly-sky-400);
    stroke-dasharray: none;
  }

  .ring-grab {
    fill: none;
    stroke: transparent;
    stroke-width: 12;
    vector-effect: non-scaling-stroke;
    cursor: grab;
    pointer-events: stroke;
  }

  .ring-handle {
    fill: var(--jolly-sky-400);
    pointer-events: none;
  }

  .ring-grab:hover + .ring-handle {
    r: 0.035px;
  }

  .ring-label {
    fill: var(--jolly-text-muted);
    font-size: 0.07px;
  }

  .path {
    fill: none;
    stroke: var(--jolly-amber-400);
    stroke-width: 1;
    opacity: 0.4;
    vector-effect: non-scaling-stroke;
  }

  .listener {
    fill: var(--jolly-surface);
    stroke: var(--jolly-ink);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .source {
    fill: var(--jolly-amber-400);
  }

  .readout {
    display: flex;
    justify-content: space-between;
    color: var(--jolly-text-muted);
    font-variant-numeric: var(--jolly-font-numeric);
  }

  .curve {
    display: block;
    box-sizing: border-box;
    inline-size: 100%;
    block-size: 56px;
    border: 1px solid var(--jolly-divider);
    border-radius: var(--jolly-radius-md, 4px);
    background: var(--jolly-surface);
  }

  .curve-line {
    fill: none;
    stroke: var(--jolly-sky-400);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .curve-marker {
    stroke: var(--jolly-amber-400);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
`;
