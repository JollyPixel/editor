// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { treeHostStyles } from "../../shared/styles/treeHost.styles.ts";

export const layerManagerStyles = [
  treeHostStyles,
  css`
    :host {
      display: block;
    }

    .tree-host {
      max-height: 200px;
    }

    .total {
      align-self: center;
      margin-inline-end: var(--jolly-space-1, 4px);
      color: var(--jolly-text-muted);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
  `
];
