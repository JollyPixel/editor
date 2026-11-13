// Import Third-party Dependencies
import { css } from "lit";

export const treeHostStyles = css`
  .tree-host {
    min-height: calc(var(--jolly-row-height, 20px) * 3);
    overflow-y: auto;
  }

  jolly-tree {
    margin-inline: var(--jolly-space-1, 4px) 0;
  }
`;
