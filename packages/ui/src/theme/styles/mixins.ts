// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "./fallbacks.ts";

/**
 * Single-line ellipsis; the element still needs a constrained inline size.
 */
export const truncate = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/**
 * Offset is set per site: handles inset the ring, controls outset it.
 */
export const focusRing = css`
  outline: 2px solid var(--jolly-focus-ring, ${kFallback.focusRing});
`;

export const fillTransition = css`
  transition: background-color var(--jolly-duration-fast, 100ms)
    var(--jolly-easing, ease);
`;

export const headerTexture = css`
  position: absolute;
  z-index: 0;
  inset-block: 0;
  inset-inline-start: 0;
  width: 52%;
  background: conic-gradient(
      from 90deg,
      transparent 25%,
      currentcolor 0 50%,
      transparent 0 75%,
      currentcolor 0
    )
    0 / 12px 12px;
  color: var(--jolly-text-on-fill, white);
  content: "";
  opacity: 0.07;
  pointer-events: none;
  mask-image: linear-gradient(to right, black, transparent);
`;

/**
 * Fades and scales a native dialog or popover carrying the
 * `overlay-motion` class, and its backdrop, in and out.
 */
export const overlayMotion = css`
  .overlay-motion,
  .overlay-motion::backdrop {
    opacity: 0;
    transition:
      opacity var(--jolly-duration-exit, 150ms) var(--jolly-easing-overlay, ease-out),
      transform var(--jolly-duration-exit, 150ms) var(--jolly-easing-overlay, ease-out),
      overlay var(--jolly-duration-exit, 150ms) allow-discrete,
      display var(--jolly-duration-exit, 150ms) allow-discrete;
  }

  .overlay-motion {
    transform: scale(var(--jolly-overlay-scale, 0.96));
    transform-origin: center;
  }

  .overlay-motion:is([open], :popover-open),
  .overlay-motion:is([open], :popover-open)::backdrop {
    opacity: 1;
    transition-duration: var(--jolly-duration-enter, 250ms);
  }

  .overlay-motion:is([open], :popover-open) {
    transform: none;
  }

  @starting-style {
    .overlay-motion:is([open], :popover-open),
    .overlay-motion:is([open], :popover-open)::backdrop {
      opacity: 0;
    }

    .overlay-motion:is([open], :popover-open) {
      transform: scale(var(--jolly-overlay-scale, 0.96));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .overlay-motion,
    .overlay-motion::backdrop {
      transition: none;
    }
  }
`;

/**
 * Hidden visually but kept in the accessibility tree.
 */
export const visuallyHidden = css`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`;

export const contentScrollbar = css`
  .content {
    scrollbar-color: var(--jolly-groove) transparent;
    scrollbar-width: thin;
  }

  .content::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .content::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 4px;
    background: var(--jolly-groove);
    background-clip: padding-box;
  }
`;
