// Import Third-party Dependencies
import { css } from "lit";

export const viewportToolbarStyles = css`
  :host {
    display: inline-flex;
  }

  jolly-tool-button::part(notch) {
    display: none;
  }

  .value {
    min-width: 3ch;
    font-weight: 600;
    text-align: center;
  }
`;
