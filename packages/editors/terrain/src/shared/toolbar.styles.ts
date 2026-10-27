// Import Third-party Dependencies
import { css } from "lit";

export const viewportToolbarStyles = css`
  :host {
    display: inline-flex;
  }

  .group {
    display: flex;
    align-items: center;
  }

  .divided::before {
    content: "";
    width: 1px;
    height: 22px;
    margin-inline: 6px;
    background: var(--jolly-divider);
  }

  jolly-tool-button {
    --jolly-tool-button-size: 30px;
    --jolly-tool-button-gap: 10px;
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
