// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "./fallbacks.ts";

/**
 * Single-line text that ellipsizes instead of wrapping. The element still needs
 * a constrained inline size: a flex or grid child will not shrink on its own.
 */
export const truncate = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/**
 * The focus indicator, minus its offset. Offset stays at the site because its
 * sign carries intent: handles inset the ring, controls outset it.
 */
export const focusRing = css`
  outline: 2px solid var(--jolly-focus-ring, ${kFallback.focusRing});
`;

/**
 * Fill transition for controls that show state through background. Which token
 * supplies the fill, and the hover and focus rules, stay per component.
 */
export const fillTransition = css`
  transition: background-color var(--jolly-duration-fast, 100ms)
    var(--jolly-easing, ease);
`;

/**
 * Hides an element while keeping it in the accessibility tree, for live regions
 * and for labels whose text is hidden but still names the control.
 */
export const visuallyHidden = css`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`;
