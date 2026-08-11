// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/fallbacks.ts";

export const floatingStyles = css`
  /*
   * A floating window is a plane and genuinely detached, so it owns both the
   * raised surface and the shadow. The pane it holds paints nothing.
   */
  :host {
    position: fixed;
    display: block;
    box-sizing: border-box;
    width: 320px;
    height: 360px;
    min-width: 0;
    min-height: 0;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-surface-raised, ${kFallback.controlBg});
    box-shadow: var(--jolly-shadow-floating, 0 4px 16px rgb(0 0 0 / 0.3));
  }

  .content {
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: var(--jolly-radius-md, 6px);
  }

  ::slotted(jolly-pane) {
    width: 100%;
    height: 100%;
    background: transparent;
  }

  .resize-handle {
    position: absolute;
    z-index: 1;
    border: 0;
    background: transparent;
    touch-action: none;
  }

  .resize-handle::after {
    position: absolute;
    background: var(--jolly-groove);
    content: "";
    opacity: 0;
  }

  .resize-handle:hover::after,
  .resize-handle:focus-visible::after {
    opacity: 1;
  }

  .resize-handle.right {
    top: 0;
    right: -4px;
    bottom: 0;
    width: 8px;
    cursor: ew-resize;
  }

  .resize-handle.right::after {
    top: 0;
    bottom: 0;
    left: 3px;
    width: 2px;
  }

  .resize-handle.bottom {
    right: 0;
    bottom: -4px;
    left: 0;
    height: 8px;
    cursor: ns-resize;
  }

  .resize-handle.bottom::after {
    top: 3px;
    right: 0;
    left: 0;
    height: 2px;
  }

  .resize-handle:focus-visible {
    outline: 2px solid var(--jolly-focus-ring, ${kFallback.focusRing});
    outline-offset: -2px;
  }
`;
