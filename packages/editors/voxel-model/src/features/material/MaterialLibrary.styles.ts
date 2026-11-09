// Import Third-party Dependencies
import { css } from "lit";

export const materialLibraryStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    min-height: 0;
    box-sizing: border-box;
    container-type: inline-size;
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--jolly-space-2, 8px);
    padding-block: var(--jolly-space-1, 4px);
    padding-inline: var(--jolly-space-1, 4px) 0;
    border-bottom: 1px solid var(--jolly-separator-rule);
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    padding-block-start: var(--jolly-space-1, 4px);
  }

  .editors {
    display: inline-flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
    color: var(--jolly-text-muted, inherit);
  }

  .editor-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .apply {
    margin-inline-start: auto;
  }

  .layout {
    display: grid;
    flex: 1 1 auto;
    grid-template-columns: 220px minmax(0, 1fr);
    min-height: 0;
  }

  .library {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid var(--jolly-separator-rule);
  }

  @container (width < 480px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(96px, 30%) minmax(0, 1fr);
    }

    .library {
      border-right: 0;
      border-bottom: 1px solid var(--jolly-separator-rule);
    }
  }

  .actions {
    display: flex;
    gap: var(--jolly-space-1, 4px);
    padding: var(--jolly-space-1, 4px);
  }

  jolly-tree {
    flex: 1 1 auto;
    overflow: auto;
    padding-inline: 2px var(--jolly-space-1, 4px);
  }

  jolly-tree::part(grip) {
    display: none;
  }

  .editor {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .scroll {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--jolly-row-gap, 4px);
    min-height: 0;
    overflow: auto;
    padding-block: var(--jolly-space-1, 4px);
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--jolly-row-gap, 4px);
    padding-inline: var(--jolly-space-1, 4px) 0;
  }

  .group-state {
    color: var(--jolly-text-muted, inherit);
  }

  .note {
    margin: 0;
    padding-inline: var(--jolly-space-1, 4px) 0;
    color: var(--jolly-text-muted, inherit);
    font-size: 0.9em;
  }

  .empty {
    margin: 0;
    padding: var(--jolly-space-2, 8px);
    color: var(--jolly-text-muted, inherit);
  }
`;
