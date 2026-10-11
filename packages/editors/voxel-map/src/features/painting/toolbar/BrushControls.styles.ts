// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { viewportToolbarStyles } from "../../../shared/styles/viewportToolbar.styles.ts";

export const brushControlsStyles = [viewportToolbarStyles, css`
  :host {
    display: inline-flex;
  }

  :host([disabled]) .brush {
    opacity: 0.6;
  }

  jolly-tool-button[slot="flyout"] {
    --jolly-tool-button-gap: 8px;
  }

  .size {
    min-width: 2ch;
    font-weight: 600;
    text-align: center;
  }
`];
