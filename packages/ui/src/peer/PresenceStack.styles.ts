// Import Third-party Dependencies
import { css } from "lit";

export const presenceStackStyles = css`
  :host {
    --jolly-presence-stack-size: 32px;
    --jolly-presence-stack-overlap: 8px;

    display: inline-block;
    color: var(--jolly-text);
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
  }

  .stack {
    display: flex;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .peer {
    position: relative;
    display: flex;
  }

  .peer + .peer {
    margin-inline-start: calc(var(--jolly-presence-stack-overlap) * -1);
  }

  .peer:hover,
  .peer:focus-within {
    z-index: 1;
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--jolly-presence-stack-size);
    height: var(--jolly-presence-stack-size);
    box-sizing: border-box;
    margin: 0;
    padding: 2px;
    border: none;
    border-radius: 50%;
    background: var(--jolly-peer-color);
    box-shadow: 0 0 8px color-mix(in oklab, var(--jolly-peer-color) 45%, transparent);
    color: inherit;
    font: inherit;
    transition:
      transform var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease),
      box-shadow var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  button.chip {
    cursor: pointer;
  }

  .chip:focus-visible {
    outline: 2px solid var(--jolly-focus-ring);
    outline-offset: 2px;
  }

  button.chip:hover,
  button.chip:focus-visible {
    box-shadow: 0 0 12px 1px color-mix(in oklab, var(--jolly-peer-color) 70%, transparent);
    transform: translateY(-2px);
  }

  jolly-avatar {
    --jolly-avatar-size: 100%;
  }

  .more {
    background: var(--jolly-surface-raised);
    box-shadow: none;
    color: var(--jolly-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .tooltip {
    position: absolute;
    inset-block-end: calc(100% + 6px);
    inset-inline-start: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 3px 8px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-surface-raised);
    box-shadow: var(--jolly-shadow-overlay);
    color: var(--jolly-text);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);
  }

  .peer:hover .tooltip,
  .chip:focus-visible .tooltip {
    opacity: 1;
    visibility: visible;
  }

  .badge {
    margin-inline-start: var(--jolly-space-1, 4px);
    color: var(--jolly-text-muted);
  }
`;
