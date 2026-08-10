// Import Third-party Dependencies
import {
  svg,
  type SVGTemplateResult
} from "lit";

export type IconName =
  | "move"
  | "paint"
  | "fill"
  | "fillGlobal"
  | "select"
  | "wand"
  | "uv"
  | "undo"
  | "redo"
  | "copy"
  | "paste"
  | "rotateClockwise"
  | "flipHorizontal"
  | "flipVertical"
  | "clearTexture"
  | "swap"
  | "eyedropper"
  | "import"
  | "export"
  | "add"
  | "cube"
  | "triangle"
  | "trash"
  | "collapse"
  | "expand"
  | "label"
  | "eye";

// CONSTANTS
const kIcons: Record<IconName, SVGTemplateResult> = {
  // Pan hand.
  move: svg`
    <path
      d="M6 9v5"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      d="M9 6v6"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      d="M12 5v7"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      d="M15 6v6"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      d="M6 14a6 6 0 0 0 6 6h1a6 6 0 0 0 6-6v-3a1.5 1.5 0 0 0-3 0"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `,
  // Pencil.
  paint: svg`
    <path
      d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `,
  // Paint bucket.
  fill: svg`
    <g transform="rotate(-20 12 11)">
      <path
        d="M6 4h10l-1.5 12a2 2 0 0 1-2 1.8h-3a2 2 0 0 1-2-1.8L6 4Z"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <path
        d="M5.3 8h11.4"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
      />
    </g>
    <path
      d="M14 15c1.5 1.5 2 2.7 2 3.6"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
    <circle cx="18.5" cy="19.5" r="1.9" fill="currentColor" />
  `,
  // Bucket's neighbor fill, generalized: every matching cell, not just the
  // connected region.
  fillGlobal: svg`
    <rect x="4" y="4" width="7" height="7" rx="1.3" fill="currentColor" />
    <rect x="13" y="4" width="7" height="7" rx="1.3" fill="currentColor" />
    <rect x="4" y="13" width="7" height="7" rx="1.3" fill="currentColor" />
    <rect x="13" y="13" width="7" height="7" rx="1.3" fill="currentColor" />
  `,
  // Marquee selection.
  select: svg`
    <rect
      x="4.5"
      y="4.5"
      width="15"
      height="15"
      rx="1"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-dasharray="3.5 3"
    />
    <circle cx="4.5" cy="4.5" r="1.7" fill="currentColor" />
    <circle cx="19.5" cy="4.5" r="1.7" fill="currentColor" />
    <circle cx="4.5" cy="19.5" r="1.7" fill="currentColor" />
    <circle cx="19.5" cy="19.5" r="1.7" fill="currentColor" />
  `,
  // Magic wand: shape select follows same-color pixels, not a rectangle.
  wand: svg`
    <path
      d="M5 19 15.5 8.5"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      d="M18 4l.9 2.1L21 7l-2.1.9L18 10l-.9-2.1L15 7l2.1-.9L18 4Z"
      fill="currentColor"
    />
    <circle cx="12.5" cy="5" r="1" fill="currentColor" />
    <circle cx="20" cy="12.5" r="1" fill="currentColor" />
  `,
  // UV grid.
  uv: svg`
    <rect
      x="4"
      y="4"
      width="7"
      height="7"
      rx="1"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
    <rect
      x="13"
      y="4"
      width="7"
      height="7"
      rx="1"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-dasharray="2.5 2.5"
    />
    <rect
      x="4"
      y="13"
      width="7"
      height="7"
      rx="1"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-dasharray="2.5 2.5"
    />
    <rect
      x="13"
      y="13"
      width="7"
      height="7"
      rx="1"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
  `,
  undo: svg`
    <path
      d="M4 10h6a6 6 0 1 1-5.7 8"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M4 5v5h5"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `,
  redo: svg`
    <path
      d="M20 10h-6a6 6 0 1 0 5.7 8"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M20 5v5h-5"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `,
  copy: svg`
    <rect
      x="8"
      y="8"
      width="12"
      height="12"
      rx="2"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
    <path
      d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `,
  paste: svg`
    <path
      d="M9 5h6M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
  `,
  rotateClockwise: svg`
    <path
      d="M20 11a8 8 0 1 0-2.3 6"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
    <path
      d="M20 5v6h-6"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `,
  flipHorizontal: svg`
    <path d="M12 3v18" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2" />
    <path
      d="M4 6l6 6-6 6V6ZM20 6l-6 6 6 6V6Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
  `,
  flipVertical: svg`
    <path d="M3 12h18" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2" />
    <path
      d="M6 4l6 6 6-6H6ZM6 20l6-6 6 6H6Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
  `,
  clearTexture: svg`
    <rect
      x="4"
      y="4"
      width="16"
      height="16"
      rx="2"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
    <path
      d="M7 17 17 7"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
    <path
      d="m7 13 4 4"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
  `,
  swap: svg`
    <path
      d="M3 8h13"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      d="M13 4l4 4-4 4"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M21 16H8"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      d="M11 20l-4-4 4-4"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `,
  // Eyedropper.
  eyedropper: svg`
    <path
      d="M11 7l6 6"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      d="M4 16 15.7 4.3a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4L8 20H4v-4Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  `,
  // Import.
  import: svg`
    <path
      d="M12 15V4"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M7.5 8.5 12 4l4.5 4.5"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `,
  // Export.
  export: svg`
    <path
      d="M12 4v11"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M7.5 10.5 12 15l4.5-4.5"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `,
  add: svg`
    <path
      d="M12 5v14"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      d="M5 12h14"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
  `,
  // Isometric cube.
  cube: svg`
    <path
      d="m12 3 7 4v8l-7 4-7-4V7l7-4Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <path
      d="m5 7 7 4 7-4M12 11v8"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
    />
  `,
  // Triangular ramp profile.
  triangle: svg`
    <path
      d="M5 19 12 5l7 14H5Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
  `,
  // Trash can.
  trash: svg`
    <path
      d="M4 7h16"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
    <path
      d="M9 7V4.8c0-.44.36-.8.8-.8h4.4c.44 0 .8.36.8.8V7"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
    <path
      d="M6.5 7 7.3 19.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    <path
      d="M10 11v6"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M14 11v6"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  `,
  // Corners pointing inward: merge into one.
  collapse: svg`
    <path
      d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M15 4v3.5A1.5 1.5 0 0 0 16.5 9H20"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M9 20v-3.5A1.5 1.5 0 0 0 7.5 15H4"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M15 20v-3.5A1.5 1.5 0 0 1 16.5 15H20"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `,
  // Corners pointing outward: split into faces.
  expand: svg`
    <path
      d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M20 9V5.5A1.5 1.5 0 0 0 18.5 4H15"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20H9"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `,
  // Text label inside a region frame.
  label: svg`
    <rect
      x="3.5"
      y="5"
      width="17"
      height="14"
      rx="2"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
    <path
      d="M7 9h10M7 13h6"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
  `,
  eye: svg`
    <path
      d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="2.2" />
  `
};

export function renderIcon(
  name: IconName
): SVGTemplateResult {
  return svg`
    <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      ${kIcons[name]}
    </svg>
  `;
}
