// Import Third-party Dependencies
import { css } from "lit";

export const statsStyles = css`
  :host {
    display: block;
    width: 112px;
    height: 56px;
    border-radius: var(--jolly-radius-sm, 2px);
    cursor: pointer;
    user-select: none;

    --jolly-stats-fps: light-dark(#007c91, #00ffff);
    --jolly-stats-fps-bed: light-dark(#d8f7fb, #001122);
    --jolly-stats-ms: light-dark(#16733a, #00ff66);
    --jolly-stats-ms-bed: light-dark(#def6e6, #00220d);
    --jolly-stats-worst: light-dark(#a65300, #ff9d00);
    --jolly-stats-worst-bed: light-dark(#fff0d6, #221100);
    --jolly-stats-mb: light-dark(#a6005a, #ff0088);
    --jolly-stats-mb-bed: light-dark(#ffe0ef, #220011);
  }

  :host([hidden]) {
    display: none;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border-radius: inherit;
    background: transparent;
  }

  :host(:hover) {
    filter: brightness(1.08);
  }

  :host(:focus-visible) {
    outline: 2px solid var(--jolly-focus-ring, Highlight);
    outline-offset: 1px;
  }

  :host(:active) {
    filter: brightness(0.94);
  }

  @media (forced-colors: active) {
    canvas {
      border: 1px solid ButtonBorder;
    }

    :host(:focus-visible) {
      outline-color: Highlight;
    }
  }
`;
