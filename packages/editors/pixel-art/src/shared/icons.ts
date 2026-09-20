// Import Third-party Dependencies
import {
  html,
  svg,
  type TemplateResult
} from "lit";

// Import Internal Dependencies
import { registerIcon } from "@jolly-pixel/ui/icon";

export type IconName =
  | "move"
  | "paint"
  | "eraser"
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
  | "rotateCounterClockwise"
  | "flipHorizontal"
  | "flipVertical"
  | "clearTexture"
  | "swap"
  | "eyedropper"
  | "import"
  | "export"
  | "add"
  | "edit"
  | "cube"
  | "triangle"
  | "trash"
  | "collapse"
  | "expand"
  | "unfold"
  | "chevronDown"
  | "label"
  | "eye"
  | "dockPicker";

registerIcon("move", svg`
    <path
      class="tone-ink"
      d="M6 9v5M9 6v6M12 5v7M15 6v6"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      class="tone-ink"
      d="M6 14a6 6 0 0 0 6 6h1a6 6 0 0 0 6-6v-3a1.5 1.5 0 0 0-3 0"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `, { tone: "teal" });

registerIcon("paint", svg`
    <path
      class="tone-ink"
      d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `, { tone: "coral" });

registerIcon("eraser", svg`
    <g transform="rotate(-45 12 12)">
      <rect
        class="tone-ink"
        x="2.5"
        y="8"
        width="19"
        height="8"
        rx="1.8"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
      />
      <path
        class="tone-ink"
        d="M9.5 8v8"
        stroke="currentColor"
        stroke-width="2.2"
      />
    </g>
    <path
      d="M4 21h16"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
  `, { tone: "pink" });

registerIcon("fill", svg`
    <g transform="rotate(-20 12 11)">
      <path
        class="tone-ink"
        d="M6 4h10l-1.5 12a2 2 0 0 1-2 1.8h-3a2 2 0 0 1-2-1.8L6 4Z"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <path
        class="tone-ink"
        d="M5.3 8h11.4"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
      />
    </g>
    <path
      class="tone-ink"
      d="M14 15c1.5 1.5 2 2.7 2 3.6"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
    <circle class="tone-ink" cx="18.5" cy="19.5" r="1.9" fill="currentColor" />
  `, { tone: "sky" });

registerIcon("fillGlobal", svg`
    <rect class="tone-ink" x="4" y="4" width="7" height="7" rx="1.3" fill="currentColor" />
    <rect x="13" y="4" width="7" height="7" rx="1.3" fill="currentColor" />
    <rect x="4" y="13" width="7" height="7" rx="1.3" fill="currentColor" />
    <rect class="tone-ink" x="13" y="13" width="7" height="7" rx="1.3" fill="currentColor" />
  `, { tone: "sky" });

registerIcon("select", svg`
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
    <circle class="tone-ink" cx="4.5" cy="4.5" r="1.7" fill="currentColor" />
    <circle class="tone-ink" cx="19.5" cy="4.5" r="1.7" fill="currentColor" />
    <circle class="tone-ink" cx="4.5" cy="19.5" r="1.7" fill="currentColor" />
    <circle class="tone-ink" cx="19.5" cy="19.5" r="1.7" fill="currentColor" />
  `, { tone: "violet" });

registerIcon("wand", svg`
    <path
      d="M5 19 15.5 8.5"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      class="tone-ink"
      d="M18 4l.9 2.1L21 7l-2.1.9L18 10l-.9-2.1L15 7l2.1-.9L18 4Z"
      fill="currentColor"
    />
    <circle class="tone-ink" cx="12.5" cy="5" r="1" fill="currentColor" />
    <circle class="tone-ink" cx="20" cy="12.5" r="1" fill="currentColor" />
  `, { tone: "amber" });

registerIcon("uv", svg`
    <rect
      class="tone-ink"
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
      class="tone-ink"
      x="13"
      y="13"
      width="7"
      height="7"
      rx="1"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
  `, { tone: "lime" });

registerIcon("undo", svg`
    <path
      class="tone-ink"
      d="M4 10h6a6 6 0 1 1-5.7 8"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      class="tone-ink"
      d="M4 5v5h5"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `, { tone: "teal" });

registerIcon("redo", svg`
    <path
      class="tone-ink"
      d="M20 10h-6a6 6 0 1 0 5.7 8"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      class="tone-ink"
      d="M20 5v5h-5"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `, { tone: "teal" });

registerIcon("copy", svg`
    <rect
      class="tone-ink"
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
  `, { tone: "sky" });

registerIcon("paste", svg`
    <path
      d="M9 5h6M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      class="tone-ink"
      d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
  `, { tone: "sky" });

registerIcon("rotateClockwise", svg`
    <path
      class="tone-ink"
      d="M20 11a8 8 0 1 0-2.3 6"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
    <path
      class="tone-ink"
      d="M20 5v6h-6"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `, { tone: "amber" });

registerIcon("rotateCounterClockwise", svg`
    <path
      class="tone-ink"
      d="M4 11a8 8 0 1 1 2.3 6"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
    <path
      class="tone-ink"
      d="M4 5v6h6"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `, { tone: "amber" });

registerIcon("flipHorizontal", svg`
    <path d="M12 3v18" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2" />
    <path
      class="tone-ink"
      d="M4 6l6 6-6 6V6ZM20 6l-6 6 6 6V6Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
  `, { tone: "amber" });

registerIcon("flipVertical", svg`
    <path d="M3 12h18" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2" />
    <path
      class="tone-ink"
      d="M6 4l6 6 6-6H6ZM6 20l6-6 6 6H6Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
  `, { tone: "amber" });

registerIcon("clearTexture", svg`
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
      class="tone-ink"
      d="M7 17 17 7"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
    <path
      class="tone-ink"
      d="m7 13 4 4"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
  `, { tone: "coral" });

registerIcon("swap", svg`
    <path
      class="tone-ink"
      d="M3 8h13"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      class="tone-ink"
      d="M13 4l4 4-4 4"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      class="tone-ink"
      d="M21 16H8"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      class="tone-ink"
      d="M11 20l-4-4 4-4"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `, { tone: "teal" });

registerIcon("eyedropper", svg`
    <path
      class="tone-ink"
      d="M11 7l6 6"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <path
      class="tone-ink"
      d="M4 16 15.7 4.3a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4L8 20H4v-4Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  `, { tone: "pink" });

registerIcon("import", svg`
    <path
      class="tone-ink"
      d="M12 15V4"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      class="tone-ink"
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
  `, { tone: "lime" });

registerIcon("export", svg`
    <path
      class="tone-ink"
      d="M12 4v11"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      class="tone-ink"
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
  `, { tone: "sky" });

registerIcon("add", svg`
    <path
      class="tone-ink"
      d="M12 5v14M5 12h14"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
  `, { tone: "lime" });

registerIcon("cube", svg`
    <path
      class="tone-ink"
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
  `, { tone: "amber" });

registerIcon("triangle", svg`
    <path
      class="tone-ink"
      d="M5 19 12 5l7 14H5Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
  `, { tone: "amber" });

registerIcon("edit", svg`
    <path
      class="tone-ink"
      d="M4 20l1-4.5L15.8 4.7a1.6 1.6 0 0 1 2.3 0l1.2 1.2a1.6 1.6 0 0 1 0 2.3L8.5 19 4 20Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linejoin="round"
    />
    <path
      class="tone-ink"
      d="M13.5 7l3.5 3.5"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
  `, { tone: "coral" });

registerIcon("trash", svg`
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
      class="tone-ink"
      d="M6.5 7 7.3 19.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    <path
      class="tone-ink"
      d="M10 11v6M14 11v6"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  `, { tone: "coral" });

registerIcon("collapse", svg`
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
  `);

registerIcon("expand", svg`
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
  `);

registerIcon("label", svg`
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
      class="tone-ink"
      d="M7 9h10M7 13h6"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
  `, { tone: "violet" });

registerIcon("unfold", svg`
    <path
      class="tone-ink"
      d="M3 5h18v14H3zM9 5v14M15 5v14M3 12h18"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
  `, { tone: "lime" });

registerIcon("chevronDown", svg`
    <path
      d="m6 9 6 6 6-6"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `);

registerIcon("dockPicker", svg`
    <rect
      x="3"
      y="4"
      width="18"
      height="16"
      rx="2"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
    <path
      d="M3 14h18v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      fill="currentColor"
    />
  `);

export function renderIcon(
  name: IconName
): TemplateResult {
  return html`<jolly-icon class="icon" name=${name} aria-hidden="true"></jolly-icon>`;
}
