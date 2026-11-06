// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { viewportToolbarStyles } from "./viewportToolbar.styles.ts";

export const sceneToolbarStyles = [
  viewportToolbarStyles,
  css`
    :host {
      display: inline-flex;
    }

    jolly-tool-button {
      --jolly-tool-button-size: 30px;
      --jolly-tool-button-gap: 10px;
    }
  `
];
