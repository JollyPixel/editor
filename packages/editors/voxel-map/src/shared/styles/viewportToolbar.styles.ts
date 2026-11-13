// Import Third-party Dependencies
import { css } from "lit";

export const viewportToolbarStyles = css`
  :host {
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

  jolly-tool-button::part(notch) {
    display: none;
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
