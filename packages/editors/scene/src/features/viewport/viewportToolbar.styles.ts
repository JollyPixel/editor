// Import Third-party Dependencies
import { css } from "lit";

export const viewportToolbarStyles = css`
  .group {
    display: flex;
    align-items: center;
  }

  .divided::before {
    content: "";
    flex: 0 0 auto;
    width: 1px;
    height: 22px;
    margin-inline: 6px;
    background: var(--jolly-divider);
  }

  jolly-tool-button::part(button) {
    border-radius: var(--jolly-radius-sm, 2px);
  }
`;
