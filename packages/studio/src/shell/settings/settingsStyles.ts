// Import Third-party Dependencies
import { css } from "lit";

export const settingsStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: var(--jolly-space-3);
  }

  section {
    display: flex;
    flex-direction: column;
    gap: var(--jolly-space-1);
  }

  .error {
    margin: 0;
    padding-inline: var(--jolly-space-1);
    color: var(--jolly-danger);
  }
`;
