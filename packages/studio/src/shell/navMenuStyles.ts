// Import Third-party Dependencies
import { css } from "lit";

export const navMenuStyles = css`
  .menu {
    flex: 0 0 220px;
  }

  nav {
    flex: 1 1 auto;
    min-height: 0;
    padding-block: var(--jolly-space-2);
    overflow-y: auto;
  }

  nav section + section {
    margin-top: var(--jolly-space-3);
  }

  nav h3 {
    margin: 0;
    padding: var(--jolly-space-1) var(--jolly-space-3);
    color: var(--jolly-text-muted);
    font-size: 0.8em;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  nav ul {
    margin: 0;
    padding: 0 var(--jolly-space-1);
    list-style: none;
  }

  nav button span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
