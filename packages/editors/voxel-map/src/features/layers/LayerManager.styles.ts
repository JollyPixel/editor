// Import Third-party Dependencies
import { css } from "lit";

export const layerManagerStyles = css`
  :host {
    display: block;
  }

  .tree-host {
    min-height: calc(var(--jolly-row-height, 20px) * 3);
    max-height: 200px;
    overflow-y: auto;
  }

  jolly-tree {
    margin-inline: var(--jolly-space-1, 4px);
  }

  .total {
    align-self: center;
    margin-inline-end: var(--jolly-space-1, 4px);
    color: var(--jolly-text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .hint {
    margin: 0;
    padding: var(--jolly-space-1, 4px);
    color: var(--jolly-text-muted);
  }
`;
