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

export const settingsColumnsStyles = css`
  :host {
    container-type: inline-size;
  }

  .columns {
    display: flex;
    flex-direction: column;
    gap: var(--jolly-space-4);
    max-width: var(--studio-settings-column);
  }

  @container (min-width: 54rem) {
    .columns.split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
      max-width: none;
    }
  }
`;
