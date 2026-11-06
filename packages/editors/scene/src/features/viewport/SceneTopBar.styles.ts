// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { viewportToolbarStyles } from "./viewportToolbar.styles.ts";

export const sceneTopBarStyles = [
  viewportToolbarStyles,
  css`
    :host {
      display: block;
    }

    jolly-rail {
      gap: 0;
      width: 100%;
      height: var(--scene-top-bar-height);
      background: color-mix(in srgb, var(--jolly-surface) 90%, transparent);
    }

    .group {
      gap: 4px;
    }

    .divided::before {
      margin-inline: 6px 2px;
    }

    .end {
      margin-inline-start: auto;
    }

    jolly-tool-button {
      --jolly-tool-button-size: 26px;
      --jolly-tool-button-gap: 6px;
    }
  `
];
