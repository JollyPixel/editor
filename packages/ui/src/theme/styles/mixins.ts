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
