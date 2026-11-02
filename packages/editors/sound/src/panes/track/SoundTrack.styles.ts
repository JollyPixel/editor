// Import Third-party Dependencies
import { css } from "lit";

export const soundTrackStyles = css`
  :host {
    display: block;
    color: var(--jolly-text);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1);
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: var(--jolly-font-size, 11px);
  }

  .time {
    padding-inline: var(--jolly-space-2);
    font-variant-numeric: var(--jolly-font-numeric);
  }

  .direction {
    inline-size: calc(var(--jolly-icon-button-size, 32px) * 2 + 1px);
  }

  .speed {
    inline-size: 64px;
  }

  .volume {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-1);
    margin-inline-start: auto;
  }

  .volume jolly-slider {
    inline-size: 140px;
  }

  .driver {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-2);

    --jolly-avatar-size: 20px;
  }
`;
