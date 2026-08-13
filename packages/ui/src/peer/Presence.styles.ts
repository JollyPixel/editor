// Import Third-party Dependencies
import { css } from "lit";

export const presenceStyles = css`
  :host {
    display: block;
    color: var(--jolly-text);
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
  }

  .summary {
    min-height: var(--jolly-row-height, 20px);
    color: var(--jolly-text-muted);
    line-height: var(--jolly-row-height, 20px);
  }

  .list {
    display: grid;
    gap: var(--jolly-space-1, 4px);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .peer,
  .overflow {
    display: flex;
    align-items: center;
    min-height: var(--jolly-row-height, 20px);
  }

  .peer {
    padding-inline: var(--jolly-space-1, 4px);
  }

  .peer:nth-child(even) {
    border-radius: 2px;
    background: linear-gradient(
      to right,
      color-mix(
        in srgb,
        var(--jolly-surface) 96%,
        var(--jolly-text) 4%
      ),
      transparent 72%
    );
  }

  .swatch {
    width: 0.75em;
    height: 0.75em;
    margin-inline-end: var(--jolly-space-2, 8px);
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--jolly-border);
  }

  .overflow {
    color: var(--jolly-text-muted);
  }
`;
