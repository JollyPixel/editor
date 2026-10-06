// Import Third-party Dependencies
import { css } from "lit";

export const materialLibraryStyles = css`
  :host {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    container-type: inline-size;
  }

  jolly-folder[open] {
    flex: 1 1 auto;
    min-height: 0;
  }

  .layout {
    display: grid;
    flex: 1 1 auto;
    grid-template-columns: minmax(112px, 38%) minmax(0, 1fr);
    min-height: 160px;
  }

  .library {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid var(--jolly-divider);
  }

  @container (width < 280px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(96px, 35%) minmax(0, 1fr);
    }

    .library {
      border-right: 0;
      border-bottom: 1px solid var(--jolly-divider);
    }
  }

  jolly-tree {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding-inline: var(--jolly-space-1, 4px);
  }

  .editor {
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }

  .apply,
  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--jolly-row-gap, 4px);
    padding-inline: var(--jolly-space-1, 4px);
  }

  .fields {
    padding-block-end: var(--jolly-space-1, 4px);
  }

  .hint {
    margin: 0;
    padding: var(--jolly-space-2, 8px);
    color: var(--jolly-text-muted);
  }
`;
