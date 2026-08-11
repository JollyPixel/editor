// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/fallbacks.ts";

export const dockStyles = css`
  :host {
    position: relative;
    display: block;
    box-sizing: border-box;
    width: 240px;
    height: 100%;
    min-width: 0;
    min-height: 0;
    border-radius: 0;
    background: var(--jolly-surface, ${kFallback.controlBg});
  }

  :host([side="top"]),
  :host([side="bottom"]) {
    width: 100%;
    height: 240px;
  }

  .content {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /*
   * The dock is the plane here, so a pane inside it paints nothing of its own.
   */
  ::slotted(jolly-pane) {
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  :host([collapsed]) .content {
    visibility: hidden;
  }

  .resize-handle {
    position: absolute;
    z-index: 1;
    border: 0;
    background: var(--jolly-control-bg, ${kFallback.controlBg});
    touch-action: none;
    transition: background-color var(--jolly-duration-base, 160ms)
      var(--jolly-easing, ease);
  }

  .resize-handle::after {
    position: absolute;
    background-image: radial-gradient(
      circle,
      var(--jolly-groove) 1.1px,
      transparent 1.3px
    );
    content: "";
    pointer-events: none;
  }

  .resize-handle:hover::after,
  .resize-handle:active::after,
  .resize-handle:focus-visible::after {
    background-image: radial-gradient(
      circle,
      var(--jolly-text-on-fill, #ffffff) 1.1px,
      transparent 1.3px
    );
  }

  .resize-handle:hover,
  .resize-handle:active,
  .resize-handle:focus-visible {
    background: var(--jolly-accent-fill, ${kFallback.focusRing});
  }

  :host([side="left"]) .resize-handle,
  :host([side="right"]) .resize-handle {
    top: 0;
    bottom: 0;
    width: 8px;
    cursor: ew-resize;
  }

  :host([side="left"]) .resize-handle {
    right: -8px;
  }

  :host([side="right"]) .resize-handle {
    left: -8px;
  }

  :host([side="left"]) .resize-handle::after,
  :host([side="right"]) .resize-handle::after {
    top: 50%;
    left: 50%;
    width: 3px;
    height: 22px;
    background-repeat: repeat-y;
    background-size: 100% 7px;
    transform: translate(-50%, -50%);
  }

  :host([side="top"]) .resize-handle,
  :host([side="bottom"]) .resize-handle {
    right: 0;
    left: 0;
    height: 8px;
    cursor: ns-resize;
  }

  :host([side="top"]) .resize-handle {
    bottom: -8px;
  }

  :host([side="bottom"]) .resize-handle {
    top: -8px;
  }

  :host([side="top"]) .resize-handle::after,
  :host([side="bottom"]) .resize-handle::after {
    top: 50%;
    left: 50%;
    width: 22px;
    height: 3px;
    background-repeat: repeat-x;
    background-size: 7px 100%;
    transform: translate(-50%, -50%);
  }

  .resize-handle:focus-visible {
    outline: 2px solid var(--jolly-focus-ring, ${kFallback.focusRing});
    outline-offset: -3px;
  }
`;
