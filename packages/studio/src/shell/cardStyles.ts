// Import Third-party Dependencies
import { css } from "lit";

export const cardStyles = css`
  .card {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border-radius: var(--studio-radius);
    background: var(--studio-card);
    box-shadow: var(--studio-bevel);
  }

  .card-head {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--jolly-space-2);
    min-height: var(--studio-card-head-height);
    padding-inline: var(--jolly-space-3);
  }

  .card-title {
    display: flex;
    flex: 1;
    align-items: baseline;
    gap: var(--jolly-space-2);
    min-width: 0;
    margin: 0;
    font-size: 1em;
    font-weight: 600;
  }

  .card-body {
    flex: 1 1 auto;
    min-height: 0;
    padding: var(--jolly-space-3);
    overflow: auto;
  }
`;
