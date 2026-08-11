// Import Third-party Dependencies
import { css } from "lit";

export const toolbarStyles = css`
  :host,
  div {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1, 4px);
  }

  :host {
    min-width: 0;
    color: var(--jolly-text);
    font: inherit;
  }

  :host([orientation="vertical"]),
  :host([orientation="vertical"]) div {
    align-items: stretch;
    flex-direction: column;
  }
`;
