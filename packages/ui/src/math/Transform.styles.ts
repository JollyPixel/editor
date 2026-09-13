// Import Third-party Dependencies
import { css } from "lit";

export const transformStyles = css`
  :host {
    --jolly-gutter-width: 14px;

    display: flex;
    flex-direction: column;
    gap: var(--jolly-row-gap, 0px);
  }

  :host([label-position="top"]) {
    gap: var(--jolly-space-2, 8px);
  }
`;
