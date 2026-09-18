// Import Third-party Dependencies
import { css } from "lit";

export const brushToolbarStyles = css`
  :host {
    --voxel-toolbar-button-size: 30px;

    display: inline-flex;
  }

  jolly-rail {
    --jolly-icon-button-size: var(--voxel-toolbar-button-size);

    align-items: center;
    gap: 0;
    padding-inline: 4px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-surface-raised);
    box-shadow: var(--jolly-shadow-floating);
  }

  .group {
    display: flex;
    align-items: center;
    gap: 0;
  }

  :host([disabled]) .brush {
    opacity: 0.6;
  }

  jolly-tool-button {
    --jolly-tool-button-size: var(--voxel-toolbar-button-size);
    --jolly-tool-button-gap: 10px;
  }

  jolly-tool-button::part(button) {
    border-radius: var(--jolly-radius-sm, 2px);
  }

  jolly-tool-button::part(notch) {
    display: none;
  }

  jolly-tool-button[slot="flyout"] {
    --jolly-tool-button-gap: 8px;
  }

  .separator {
    flex: 0 0 auto;
    width: 1px;
    height: 22px;
    margin-inline: 6px;
    background: var(--jolly-divider);
  }

  .size {
    min-width: 2ch;
    font-weight: 600;
    text-align: center;
  }
`;
