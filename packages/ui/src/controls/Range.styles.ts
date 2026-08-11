// Import Third-party Dependencies
import { css } from "lit";

export const rangeStyles = css`
  .value input.end {
    flex: 1 1 0;
    min-width: 0;
    text-align: right;
  }

  .separator {
    position: relative;
    box-sizing: border-box;
    flex: 0 0 auto;
    width: 12px;
    height: 7px;
    border-inline: 1px solid currentColor;
    color: var(--jolly-text-muted);
  }

  .separator::after {
    content: "";
    position: absolute;
    inset-inline: 0;
    top: 3px;
    height: 1px;
    background: currentColor;
  }
`;
