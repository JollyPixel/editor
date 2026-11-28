// Import Third-party Dependencies
import { css } from "lit";

export const navRowStyles = css`
  .nav-row {
    --nav-row-tone: var(--jolly-accent-fill);

    position: relative;
    display: flex;
    align-items: center;
    gap: var(--jolly-space-2);
    box-sizing: border-box;
    width: 100%;
    min-height: 28px;
    padding: 0 var(--jolly-space-2);
    border: none;
    border-radius: var(--jolly-radius-sm);
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .nav-row:hover {
    background: var(--jolly-control-bg-hover);
  }

  .nav-row:is([aria-current="page"], [aria-current="true"]) {
    --jolly-icon-tone-strength: var(--jolly-icon-tone-engaged);

    background: color-mix(in oklab, var(--nav-row-tone) 18%, transparent);
    font-weight: 600;
  }

  .nav-row:is([aria-current="page"], [aria-current="true"]):hover {
    background: color-mix(in oklab, var(--nav-row-tone) 24%, transparent);
  }

  .nav-row:is([aria-current="page"], [aria-current="true"])::before {
    position: absolute;
    inset: 5px auto 5px 0;
    width: 3px;
    border-radius: 2px;
    background: var(--nav-row-tone);
    content: "";
  }

  .nav-row:focus-visible {
    outline: 2px solid var(--jolly-focus-ring);
    outline-offset: -2px;
  }
`;
