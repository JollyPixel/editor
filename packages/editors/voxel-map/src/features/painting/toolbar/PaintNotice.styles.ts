// Import Third-party Dependencies
import { css } from "lit";

export const paintNoticeStyles = css`
  :host {
    display: inline-flex;
  }

  :host([hidden]) {
    display: none;
  }

  .notice {
    --jolly-icon-size: 12px;
    --jolly-surface: var(--jolly-intent-warning-fill);

    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-surface);
    box-shadow: var(--jolly-shadow-floating);
    color: var(--jolly-text-on-fill);
    font-size: 11px;
    line-height: 16px;
    white-space: nowrap;
  }

  .notice button {
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .notice button:focus-visible {
    outline: 1px solid currentcolor;
    outline-offset: 1px;
  }
`;
