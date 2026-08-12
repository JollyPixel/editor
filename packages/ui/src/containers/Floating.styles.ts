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

  /*
   * A dragged window ghosts as a whole, surface and shadow included, so the
   * dock it is aiming at stays readable underneath it. The pane inside does
   * not dim on its own here: the window is the source being moved.
   */
  :host([dragging]) {
    opacity: 0.4;
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

  /*
   * Inset by the host's own border-radius so the strip (and its hover line)
   * stops before the rounded corner instead of running past the visible
   * surface into the void the radius cuts away. The corner handle below
   * fills the gap this leaves.
   */
  .resize-handle.right {
    top: var(--jolly-radius-md, 6px);
    right: -4px;
    bottom: var(--jolly-radius-md, 6px);
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
    right: var(--jolly-radius-md, 6px);
    bottom: -4px;
    left: var(--jolly-radius-md, 6px);
    height: 8px;
    cursor: ns-resize;
  }

  .resize-handle.bottom::after {
    top: 3px;
    right: 0;
    left: 0;
    height: 2px;
  }

  .resize-handle.corner {
    right: -4px;
    bottom: -4px;
    width: calc(var(--jolly-radius-md, 6px) + 8px);
    height: calc(var(--jolly-radius-md, 6px) + 8px);
    cursor: nwse-resize;
  }

  .resize-handle.corner::after {
    right: 4px;
    bottom: 4px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
  }

  .resize-handle:focus-visible {
    outline: 2px solid var(--jolly-focus-ring, ${kFallback.focusRing});
    outline-offset: -2px;
  }
`;
