// Import Third-party Dependencies
import { css } from "lit";

export const flagsStyles = css`
  .flags {
    display: flex;
    flex-wrap: wrap;
    flex: 1 1 auto;
    gap: var(--jolly-space-1, 4px) var(--jolly-space-2, 8px);
    min-width: 0;
    padding: 2px 0;
  }

  .flag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    user-select: none;
  }

  .value input[type="checkbox"] {
    flex: 0 0 auto;
    width: 13px;
    height: 13px;
    margin: 0;
    accent-color: var(--jolly-accent-fill);
    cursor: inherit;
  }

  :host([disabled]) .flag {
    cursor: default;
  }
`;
