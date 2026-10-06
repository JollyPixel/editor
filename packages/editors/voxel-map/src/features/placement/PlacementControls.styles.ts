// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { viewportToolbarStyles } from "../../shared/styles/viewportToolbar.styles.ts";

export const placementControlsStyles = [viewportToolbarStyles, css`
  :host {
    display: inline-flex;
    align-items: center;
  }

  .axis {
    position: absolute;
    right: 1px;
    bottom: 0;
    font-size: 9px;
    font-weight: 700;
    line-height: 1;
    pointer-events: none;
  }

  jolly-tool-button[data-tool="commit"]::part(button) {
    background: var(--jolly-accent-fill);
    color: var(--jolly-text-on-fill);
  }

  jolly-tool-button[data-tool="commit"] + jolly-tool-button {
    margin-inline-start: 2px;
  }

  .caption {
    --jolly-icon-size: 14px;

    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 24ch;
    height: 22px;
    margin-inline-start: 2px;
    padding-inline: 6px 8px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-surface-sunken);
    color: var(--jolly-text);
    font-size: 11px;
    white-space: nowrap;
    cursor: default;
  }

  .caption span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`];
