// Import Third-party Dependencies
import { css } from "lit";

export const viewportToolbarStyles = css`
  :host {
    --voxel-toolbar-button-size: 30px;
    --voxel-axis-x: light-dark(
      var(--jolly-axis-x),
      oklch(from var(--jolly-axis-x) 72% c h)
    );
    --voxel-axis-y: light-dark(
      var(--jolly-axis-y),
      oklch(from var(--jolly-axis-y) 78% c h)
    );
    --voxel-axis-z: light-dark(
      var(--jolly-axis-z),
      oklch(from var(--jolly-axis-z) 76% calc(c * 1.6) h)
    );
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

  .separator {
    flex: 0 0 auto;
    width: 1px;
    height: 22px;
    margin-inline: 6px;
    background: var(--jolly-divider);
  }

  .axis .x {
    color: var(--voxel-axis-x);
  }

  .axis .y {
    color: var(--voxel-axis-y);
  }

  .axis .z {
    color: var(--voxel-axis-z);
  }
`;
