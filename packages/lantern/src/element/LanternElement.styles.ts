// Import Third-party Dependencies
import { css } from "lit";

export const lanternStyles = css`
  :host {
    display: contents;
  }

  .overlay {
    position: fixed;
    inset: 0;
    width: 100vw;
    max-width: none;
    height: 100vh;
    max-height: none;
    padding: 0;
    margin: 0;
    overflow: hidden;
    border: 0;
    background: transparent;
    color: var(--jolly-text);
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
    pointer-events: none;
  }

  .scrim,
  .shield {
    position: absolute;
    inset: 0;
    pointer-events: auto;
  }

  .scrim {
    background: var(--jolly-dialog-backdrop);
  }

  .shield[hidden],
  .ring[hidden] {
    display: none;
  }

  .ring {
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: border-box;
    outline: 2px solid var(--jolly-focus-ring);
    pointer-events: none;
  }

  .card {
    position: absolute;
    top: 0;
    left: 0;
    display: grid;
    width: min(320px, calc(100vw - 32px));
    box-sizing: border-box;
    gap: var(--jolly-space-2, 8px);
    padding: var(--jolly-space-3, 12px);
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-surface-raised);
    box-shadow: var(--jolly-shadow-modal);
    pointer-events: auto;
  }

  .card[data-seeking] {
    opacity: 0;
    pointer-events: none;
  }

  header {
    display: flex;
    justify-content: space-between;
    gap: var(--jolly-space-2, 8px);
    color: var(--jolly-text-muted);
  }

  h2 {
    margin: 0;
    font-size: calc(var(--jolly-font-size, 11px) + 2px);
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: var(--jolly-radius-sm, 2px);
  }

  .body p {
    margin: 0 0 var(--jolly-space-2, 8px);
    line-height: 1.5;
  }

  .body p:last-child {
    margin-bottom: 0;
  }

  kbd {
    padding: 0 4px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg);
    font: inherit;
  }

  kbd.unbound {
    color: var(--jolly-text-muted);
    font-style: italic;
  }

  footer {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-2, 8px);
  }

  .spacer {
    flex: 1;
  }

  :host([settled]) .card {
    transition: transform 200ms ease;
  }

  :host([settled]) .scrim {
    transition: clip-path 200ms ease;
  }

  :host([settled]) .ring {
    transition:
      transform 200ms ease,
      width 200ms ease,
      height 200ms ease,
      border-radius 200ms ease;
  }

  @media (prefers-reduced-motion: reduce) {
    :host([settled]) .card,
    :host([settled]) .scrim,
    :host([settled]) .ring {
      transition: none;
    }
  }
`;
