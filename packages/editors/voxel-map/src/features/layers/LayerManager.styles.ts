// Import Third-party Dependencies
import { css } from "lit";

export const layerManagerStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: var(--jolly-row-gap, 4px);
    overflow: hidden;
  }

  .tree-host {
    flex: 1;
    overflow-y: auto;
  }

  jolly-tree {
    margin-inline: var(--jolly-space-1, 4px);
  }
`;
