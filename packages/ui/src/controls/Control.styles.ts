// Import Third-party Dependencies
import { css } from "lit";

export const controlStyles = css`
  :host {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: calc(var(--jolly-controls-inset, 10px) / 2);
    align-items: center;
    min-inline-size: 0;
    min-block-size: var(--jolly-control-height);
  }

  .keys {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px;
  }

  ::slotted(kbd) {
    box-sizing: border-box;
    min-inline-size: calc(var(--jolly-control-height) + 2px);
    min-block-size: calc(var(--jolly-control-height) + 2px);
    padding: 1px 6px;
    color: var(--jolly-text);
    font-family: inherit;
    font-size: calc(var(--jolly-font-size) + 1px);
    font-weight: 700;
    line-height: calc(var(--jolly-control-height) - 2px);
    text-align: center;
    letter-spacing: 0.02em;
    white-space: nowrap;
    background: color-mix(
      in oklab,
      var(--jolly-ink) 18%,
      var(--jolly-surface-raised)
    );
    border: 1px solid var(--jolly-border);
    border-radius: 3px;
  }

  .description {
    min-inline-size: 0;
    overflow: hidden;
    color: var(--jolly-text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .details-button {
    display: grid;
    place-items: center;
    box-sizing: border-box;
    inline-size: var(--jolly-control-height);
    block-size: var(--jolly-control-height);
    padding: 0;
    color: var(--jolly-text-muted);
    background: transparent;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
  }

  .details-button:hover {
    color: var(--jolly-text);
    background: var(--jolly-control-bg-hover);
  }

  .details-button:focus-visible {
    outline: 2px solid var(--jolly-focus-ring);
    outline-offset: 2px;
  }

  jolly-icon {
    inline-size: calc(var(--jolly-control-height) - 4px);
    block-size: calc(var(--jolly-control-height) - 4px);
  }

  .details {
    position: fixed;
    inset: auto;
    width: max-content;
    margin: 0;
    visibility: hidden;
    box-sizing: border-box;
    max-inline-size: min(20rem, calc(100vw - 2rem));
    padding: calc(var(--jolly-controls-inset, 10px) / 1.5);
    color: var(--jolly-text);
    font: inherit;
    line-height: 1.4;
    background: var(--jolly-surface-raised);
    border: 0;
    border-radius: 4px;
    box-shadow: var(--jolly-shadow-floating);
  }

  .details::backdrop {
    background: transparent;
  }

  @media (forced-colors: active) {
    ::slotted(kbd),
    .details {
      background: Canvas;
      border-color: CanvasText;
    }
  }
`;
