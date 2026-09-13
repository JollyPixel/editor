// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { focusRing } from "../theme/styles/mixins.ts";

export const statsStyles = css`
  :host {
    display: block;
    width: 112px;
    height: 56px;
    border-radius: var(--jolly-radius-sm, 2px);
    cursor: pointer;
    user-select: none;
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
    ${focusRing}
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
