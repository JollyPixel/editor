// Import Third-party Dependencies
import { css } from "lit";

export const sceneTopBarStyles = css`
  :host {
    display: block;
  }

  jolly-rail {
    --jolly-tool-button-size: 26px;
    --jolly-tool-button-radius: var(--jolly-radius-sm, 2px);

    gap: 0;
    width: 100%;
    height: var(--scene-top-bar-height);
    background: color-mix(in srgb, var(--jolly-surface) 90%, transparent);
  }

  jolly-rail-group {
    --jolly-rail-group-divider-inset: 6px 2px;

    gap: 4px;
  }

  .end {
    margin-inline-start: auto;
  }
`;
