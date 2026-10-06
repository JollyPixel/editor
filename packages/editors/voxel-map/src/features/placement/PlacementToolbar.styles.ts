// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { viewportToolbarStyles } from "../../shared/viewportToolbar.styles.ts";

export const placementToolbarStyles = [viewportToolbarStyles, css`
  :host {
    display: inline-flex;
  }

  :host([hidden]) {
    display: none;
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
    padding-inline: 2px 6px;
    color: var(--jolly-text-muted);
    font-size: 11px;
    white-space: nowrap;
    cursor: default;
  }

  .caption span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`];
