// Import Third-party Dependencies
import { css } from "lit";

export const soundWaveStyles = css`
  :host {
    display: block;
    color: var(--jolly-text);
  }

  .wave {
    position: relative;
    block-size: clamp(100px, 18vh, 150px);
    overflow: hidden;
    border: 1px solid var(--jolly-divider);
    border-radius: var(--jolly-radius-md, 4px);
    background: var(--jolly-surface);
  }

  .seekable {
    cursor: pointer;
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

  .cursor {
    opacity: 0.6;
  }

  .tags {
    position: absolute;
    display: flex;
    flex-direction: column-reverse;
    align-items: flex-start;
    pointer-events: none;
  }

  .tags.flipped {
    align-items: flex-end;
    transform: translateX(-100%);
  }

  .tag {
    box-sizing: border-box;
    max-inline-size: var(--tag-width);
    block-size: var(--tag-height);
    overflow: hidden;
    padding-inline: var(--jolly-space-1);
    border-inline-start: 2px solid var(--tag-color, var(--jolly-divider));
    background: color-mix(in oklab, var(--jolly-surface) 85%, transparent);
    color: var(--tag-color, var(--jolly-text-muted));
    font-size: 10px;
    font-weight: 600;
    line-height: var(--tag-height);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .flipped .tag {
    border-inline-start-width: 0;
    border-inline-end: 2px solid var(--tag-color, var(--jolly-divider));
  }

  .message {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--jolly-text-muted);
    pointer-events: none;
  }
`;
