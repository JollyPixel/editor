// Import Third-party Dependencies
import { css } from "lit";

/**
 * Keep checkboxes fixed-size and left-aligned.
 */
export const checkboxStyles = css`
  .value {
    justify-content: flex-start;
  }

  .value input[type="checkbox"] {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: var(--jolly-accent-fill);
    cursor: pointer;
  }

  :host([disabled]) .value input[type="checkbox"] {
    cursor: default;
  }
`;
