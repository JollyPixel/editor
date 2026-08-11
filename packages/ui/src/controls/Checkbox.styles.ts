// Import Third-party Dependencies
import { css } from "lit";

/** Keeps checkboxes fixed-size and aligned to the requested logical edge. */
export const checkboxStyles = css`
  .value {
    justify-content: flex-start;
  }

  :host([align="end"]) .value,
  :host([align="end"]) .checkbox {
    justify-content: flex-end;
  }

  /* Keep the native control on the same hit target as the other fields. */
  .checkbox {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: var(--jolly-control-height, 20px);
    height: var(--jolly-control-height, 20px);
  }

  .value input[type="checkbox"] {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: var(--jolly-accent-fill);
    cursor: pointer;
  }

  .value input[type="checkbox"]:focus-visible {
    outline: none;
  }

  :host([disabled]) .value input[type="checkbox"] {
    cursor: default;
  }
`;
