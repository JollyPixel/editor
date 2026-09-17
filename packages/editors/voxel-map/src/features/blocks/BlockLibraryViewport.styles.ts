// Import Third-party Dependencies
import { css } from "lit";

export const blockLibraryViewportStyles = css`
  :host {
    display: block;

    --block-grid-inset: 5px;
  }

  .scroller {
    position: relative;
    box-sizing: border-box;
    overflow: hidden auto;
    scrollbar-gutter: stable;
    min-height: 100px;
    max-height: 240px;
    padding: var(--block-grid-inset);
    background: var(--jolly-well-bg, #0e1316);
    border-radius: var(--jolly-radius-sm, 3px);
    cursor: pointer;
  }

  :host([layout="fill"]) {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }

  :host([layout="fill"]) .scroller {
    flex: 1 1 auto;
    max-height: none;
  }

  :host([sized]) .scroller {
    min-height: 0;
    max-height: none;
  }

  .grip {
    position: relative;
    z-index: 4;
    height: 6px;
    margin-block: -3px;
    cursor: ns-resize;
    touch-action: none;
    outline: none;
  }

  .scroller > canvas {
    position: relative;
    z-index: 1;
  }

  .layer {
    position: absolute;
    inset-block-start: var(--block-grid-inset);
    inset-inline-start: var(--block-grid-inset);
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .layer.highlights {
    z-index: 0;
  }

  .layer.options {
    z-index: 2;
  }

  .option {
    position: absolute;
    pointer-events: auto;
  }

  .layer.marks {
    z-index: 2;
  }

  .problem {
    position: absolute;
    box-sizing: border-box;
    border: 2px solid var(--jolly-danger);
    border-radius: var(--jolly-radius-sm, 4px);
    background: color-mix(in srgb, var(--jolly-danger) 18%, transparent);
  }

  .unused {
    position: absolute;
    box-sizing: border-box;
    border-radius: var(--jolly-radius-sm, 4px);
    background: color-mix(in srgb, var(--jolly-well-bg, #0e1316) 60%, transparent);
  }

  .layer.drop {
    z-index: 3;
  }

  .insertion {
    position: absolute;
    width: 2px;
    margin-inline-start: -1px;
    border-radius: 1px;
    background: var(--jolly-accent, #4c9aff);
    box-shadow: 0 0 0 1px var(--jolly-well-bg, #0e1316);
  }

  .layer.actions {
    z-index: 4;
  }

  .add-cell {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 2px dashed var(--jolly-border, #2a3238);
    border-radius: var(--jolly-radius-sm, 4px);
    background: transparent;
    color: var(--jolly-text-muted, #8a96a0);
    font: inherit;
    cursor: pointer;
    pointer-events: auto;
  }

  .add-cell:hover,
  .add-cell:focus-visible {
    border-color: var(--jolly-accent-fill, #4c9aff);
    background: color-mix(in srgb, var(--jolly-accent-fill, #4c9aff) 12%, transparent);
    color: var(--jolly-accent-fill, #4c9aff);
    outline: none;
  }

  .scroller.dragging {
    cursor: grabbing;
  }

  .scroller.dragging > canvas {
    opacity: 0.75;
  }

  .highlight {
    position: absolute;
    border-radius: var(--jolly-radius-sm, 4px);
    box-sizing: border-box;
    border: 2px dashed transparent;
  }

  .marker {
    position: absolute;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    gap: 2px;
    padding: 4px;
    box-sizing: border-box;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--jolly-well-bg, #0e1316);
  }
`;
