// Import Third-party Dependencies
import { css } from "lit";

export const listRowStyles = css`
  ul.rows {
    display: grid;
    gap: var(--jolly-space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  ul.rows > li {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-2);
    min-height: 40px;
    padding: var(--jolly-space-1) var(--jolly-space-2);
    border-radius: var(--jolly-radius-sm);
    background: var(--jolly-surface-sunken);
  }

  ul.rows > li > jolly-icon {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
  }

  .row-text {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .row-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-meta {
    margin: 0;
    color: var(--jolly-text-muted);
    font-size: 0.9em;
  }
`;
