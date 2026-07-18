/* eslint-disable @stylistic/max-len */
// Import Third-party Dependencies
import { svg, type SVGTemplateResult } from "lit";

export type IconName = "move" | "paint" | "fill" | "select" | "undo" | "redo" | "swap";

// CONSTANTS
const kIcons: Record<IconName, SVGTemplateResult> = {
  // Pan/grab hand: four splayed fingers over a rounded palm.
  move: svg`
    <path d="M6 9v5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M9 6v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M12 5v7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M15 6v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M6 14a6 6 0 0 0 6 6h1a6 6 0 0 0 6-6v-3a1.5 1.5 0 0 0-3 0"
      fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  // Feather "edit-2" pencil.
  paint: svg`
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
      fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  // Tilted paint bucket with a rim line and a paint drip.
  fill: svg`
    <g transform="rotate(-20 12 11)">
      <path d="M6 4h10l-1.5 12a2 2 0 0 1-2 1.8h-3a2 2 0 0 1-2-1.8L6 4Z"
        fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M5.3 8h11.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    </g>
    <path d="M14 15c1.5 1.5 2 2.7 2 3.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="18.5" cy="19.5" r="1.9" fill="currentColor"/>
  `,
  // Marquee selection: dashed rectangle with corner handles.
  select: svg`
    <rect x="4.5" y="4.5" width="15" height="15" rx="1"
      fill="none" stroke="currentColor" stroke-width="2.4" stroke-dasharray="3.5 3"/>
    <circle cx="4.5" cy="4.5" r="1.7" fill="currentColor"/>
    <circle cx="19.5" cy="4.5" r="1.7" fill="currentColor"/>
    <circle cx="4.5" cy="19.5" r="1.7" fill="currentColor"/>
    <circle cx="19.5" cy="19.5" r="1.7" fill="currentColor"/>
  `,
  undo: svg`
    <path d="M4 10h6a6 6 0 1 1-5.7 8"
      fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 5v5h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  redo: svg`
    <path d="M20 10h-6a6 6 0 1 0 5.7 8"
      fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M20 5v5h-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  swap: svg`
    <path d="M3 8h13" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M13 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M21 16H8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M11 20l-4-4 4-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  `
};

/**
 * Renders a named icon as a self-contained <svg>. Colors follow the
 * button's CSS `color` via `currentColor`, so hover/active states need no
 * icon-specific styling.
 */
export function renderIcon(
  name: IconName
): SVGTemplateResult {
  return svg`
    <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      ${kIcons[name]}
    </svg>
  `;
}
