// Import Third-party Dependencies
import { css } from "lit";

export const soundTrackStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: var(--jolly-space-3);
    height: 100%;
    padding: var(--jolly-space-4);
    color: var(--jolly-text);
  }

  .transport {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-2);
  }

  jolly-tool-button {
    --jolly-tool-button-size: 30px;
  }

  jolly-tool-button::part(button) {
    border-radius: var(--jolly-radius-sm, 2px);
  }

  .time {
    margin-inline-start: var(--jolly-space-3);
    font-family: var(--jolly-font-numeric);
  }

  .format {
    margin-inline-start: auto;
    color: var(--jolly-text-muted);
  }

  .track {
    position: relative;
    flex: 1;
    min-height: 96px;
    overflow: hidden;
    border-radius: var(--jolly-radius-md, 4px);
    background: var(--jolly-surface-sunken);
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    color: var(--jolly-accent-400);
  }

  .playhead {
    position: absolute;
    inset-block: 0;
    width: 2px;
    background: var(--jolly-ink);
    pointer-events: none;
  }

  .message {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--jolly-text-muted);
  }
`;
