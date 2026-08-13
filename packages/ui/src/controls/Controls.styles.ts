// Import Third-party Dependencies
import { css } from "lit";

export const controlsStyles = css`
  :host {
    --jolly-controls-inset: calc(var(--jolly-row-height) / 2);
    --jolly-controls-entry-min-width: 10rem;

    position: absolute;
    z-index: 1;
    display: block;
    box-sizing: border-box;
    max-inline-size: calc(100% - (var(--jolly-controls-inset) * 2));
    padding: var(--jolly-controls-inset);
    color: var(--jolly-text);
    font-family: var(--jolly-font-family);
    font-size: var(--jolly-font-size);
    line-height: 1.35;
    background: color-mix(in oklab, var(--jolly-surface-raised) 72%, transparent);
    border-radius: 4px;
    box-shadow: var(--jolly-shadow-overlay);
    backdrop-filter: blur(12px);
  }

  :host([position="top-left"]) {
    inset: var(--jolly-controls-inset) auto auto var(--jolly-controls-inset);
  }

  :host([position="top-middle"]) {
    inset: var(--jolly-controls-inset) auto auto 50%;
    transform: translateX(-50%);
  }

  :host([position="top-right"]) {
    inset: var(--jolly-controls-inset) var(--jolly-controls-inset) auto auto;
  }

  :host([position="middle-left"]) {
    inset: 50% auto auto var(--jolly-controls-inset);
    transform: translateY(-50%);
  }

  :host([position="middle"]) {
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
  }

  :host([position="middle-right"]) {
    inset: 50% var(--jolly-controls-inset) auto auto;
    transform: translateY(-50%);
  }

  :host([position="bottom-left"]) {
    inset: auto auto var(--jolly-controls-inset) var(--jolly-controls-inset);
  }

  :host([position="bottom-middle"]) {
    inset: auto auto var(--jolly-controls-inset) 50%;
    transform: translateX(-50%);
  }

  :host([position="bottom-right"]) {
    inset: auto var(--jolly-controls-inset) var(--jolly-controls-inset) auto;
  }

  .heading {
    margin: 0 0 calc(var(--jolly-controls-inset) / 2);
    color: var(--jolly-text-muted);
    font-size: inherit;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .entries {
    display: grid;
    grid-template-columns: repeat(
      var(--jolly-controls-max-entries-per-row),
      minmax(var(--jolly-controls-entry-min-width), 1fr)
    );
    gap: calc(var(--jolly-controls-inset) / 2);
  }

  @media (max-width: 32rem) {
    .entries {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 20rem) {
    .entries {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (forced-colors: active) {
    :host {
      background: Canvas;
      box-shadow: none;
    }
  }
`;
