// Import Third-party Dependencies
import { css } from "lit";

export const materialLibraryStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
  }

  .block-bar {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-2, 8px);
    padding: var(--jolly-space-1, 4px) var(--jolly-space-2, 8px);
    border-bottom: 1px solid var(--jolly-border, rgb(128 128 128 / 30%));
  }

  .block-summary {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .block-bar.idle .block-summary {
    color: var(--jolly-text-muted, inherit);
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--jolly-space-2, 8px);
    padding: var(--jolly-space-2, 8px);
    border-bottom: 1px solid var(--jolly-border, rgb(128 128 128 / 30%));
  }

  .uses {
    color: var(--jolly-text-muted, inherit);
  }

  .uses[tabindex] {
    cursor: default;
    text-decoration: underline dotted;
    text-underline-offset: 3px;
  }

  .uses[tabindex]:hover,
  .uses[tabindex]:focus-visible {
    color: var(--jolly-text, inherit);
    outline: none;
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
    border-right: 1px solid var(--jolly-border, rgb(128 128 128 / 30%));
  }

  .actions {
    display: flex;
    gap: var(--jolly-space-1, 4px);
    padding: var(--jolly-space-1, 4px);
  }

  jolly-tree {
    flex: 1 1 auto;
    overflow: auto;
    padding-inline: var(--jolly-space-1, 4px);
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
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--jolly-space-1, 4px);
    padding: var(--jolly-space-1, 4px);
  }

  .group-state {
    color: var(--jolly-text-muted, inherit);
  }

  .note {
    margin: 0;
    padding: var(--jolly-space-1, 4px);
    color: var(--jolly-text-muted, inherit);
    font-size: 0.9em;
  }

  .empty,
  .help {
    margin: 0;
    padding: var(--jolly-space-2, 8px);
    color: var(--jolly-text-muted, inherit);
  }

  .help {
    padding-bottom: 0;
  }
`;
