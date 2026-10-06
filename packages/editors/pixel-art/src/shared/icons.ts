// Import Third-party Dependencies
import {
  html,
  svg,
  type TemplateResult
} from "lit";
import { registerIcon } from "@jolly-pixel/ui/icon";

// Import Internal Dependencies
import type { NormalMapIconName } from "./normalMapIcons.ts";
import "./normalMapIcons.ts";

// CONSTANTS
const kTextGlyphs = {
  uv: {
    text: "UV",
    tone: "lime"
  }
} as const;

export type IconName =
  | "move"
  | "paint"
  | "eraser"
  | "fill"
  | "fillGlobal"
  | "select"
  | "wand"
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
  | "ruler"
  | "eyeOpen"
  | "eyeOff"
  | "dockPicker"
  | NormalMapIconName;

registerIcon("move", svg`
    <path
      class="tone-ink"
      d="M12 3v18M3 12h18"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
    <path
      class="tone-ink"
      d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `, { tone: "teal" });

registerIcon("paint", svg`
    <mask id="paint-ferrule-cut">
      <rect width="24" height="24" fill="#fff" />
      <path d="M13.2 6.3l4.5 4.5" stroke="#000" stroke-width="1.6" />
    </mask>
    <path
      class="tone-ink"
      d="M15.5 3.5a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3L9 20l-5.5 1.5L5 16 15.5 3.5Z"
      fill="currentColor"
      mask="url(#paint-ferrule-cut)"
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
      class="tone-ink"
      d="M4 21h16"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
  `, { tone: "pink" });

registerIcon("fill", svg`
    <path
      class="tone-ink"
      d="M2.6 13H17l-6.6 6.6a2 2 0 0 1-2.8 0L2.4 14.4Z"
      fill="currentColor"
      fill-opacity="0.4"
    />
    <path
      class="tone-ink"
      d="M19 11 11 3l-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
    <path
      class="tone-ink"
      d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"
      fill="currentColor"
    />
  `, { tone: "sky" });

registerIcon("fillGlobal", svg`
    <path
      class="tone-ink"
      d="M2.6 13H17l-6.6 6.6a2 2 0 0 1-2.8 0L2.4 14.4Z"
      fill="currentColor"
      fill-opacity="0.4"
    />
    <path
      class="tone-ink"
      d="M19 11 11 3l-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
    <path
      class="tone-ink"
      d="M19.5.7l1.03 2.77 2.77 1.03-2.77 1.03-1.03 2.77-1.03-2.77-2.77-1.03 2.77-1.03Z"
      fill="currentColor"
    />
  `, { tone: "sky" });

registerIcon("select", svg`
    <rect
      class="tone-ink"
      x="4.5"
      y="4.5"
      width="15"
      height="15"
      fill="currentColor"
      fill-opacity="0.4"
    />
    <rect
      class="tone-ink"
      x="4.5"
      y="4.5"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-dasharray="3.5 3"
    />
  `, { tone: "violet" });

registerIcon("wand", svg`
    <path
      class="tone-ink"
      d="M4 4h9v5h7v11h-9v-5H4Z"
      fill="currentColor"
      fill-opacity="0.4"
    />
    <path
      class="tone-ink"
      d="M4 4h9v5h7v11h-9v-5H4Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-dasharray="3.5 3"
    />
  `, { tone: "violet" });

registerIcon("undo", svg`
    <path
      class="tone-ink"
      d="M8.5 4 3 9l5.5 5Z"
      fill="currentColor"
    />
    <path
      class="tone-ink"
      d="M7 9h7.5a5 5 0 0 1 0 10H10"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `, { tone: "teal" });

registerIcon("redo", svg`
    <path
      class="tone-ink"
      d="M15.5 4 21 9l-5.5 5Z"
      fill="currentColor"
    />
    <path
      class="tone-ink"
      d="M17 9H9.5a5 5 0 0 0 0 10H14"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
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
      class="tone-ink"
      d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <rect
      class="tone-ink"
      x="8.5"
      y="2.5"
      width="7"
      height="5"
      rx="1.2"
      fill="currentColor"
    />
  `, { tone: "sky" });

registerIcon("rotateClockwise", svg`
    <path
      class="tone-ink"
      d="M18.5 12.5a6.5 6.5 0 1 1-2-4.7"
      fill="none"
      stroke="currentColor"
      stroke-width="2.8"
      stroke-linecap="round"
    />
    <path class="tone-ink" d="M21.5 2v8.5H13Z" fill="currentColor" />
  `, { tone: "amber" });

registerIcon("rotateCounterClockwise", svg`
    <path
      class="tone-ink"
      d="M5.5 12.5a6.5 6.5 0 1 0 2-4.7"
      fill="none"
      stroke="currentColor"
      stroke-width="2.8"
      stroke-linecap="round"
    />
    <path class="tone-ink" d="M2.5 2v8.5H11Z" fill="currentColor" />
  `, { tone: "amber" });

registerIcon("flipHorizontal", svg`
    <path
      class="tone-ink"
      d="M12 3v18"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
    />
    <path class="tone-ink" d="M9 6 3 18h6Z" fill="currentColor" />
    <path
      class="tone-ink"
      d="M15 6l6 12h-6Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
  `, { tone: "amber" });

registerIcon("flipVertical", svg`
    <path
      class="tone-ink"
      d="M3 12h18"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
    />
    <path class="tone-ink" d="M18 9 6 3v6Z" fill="currentColor" />
    <path
      class="tone-ink"
      d="M18 15 6 21v-6Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
  `, { tone: "amber" });

registerIcon("clearTexture", svg`
    <rect
      class="tone-ink"
      x="3"
      y="3"
      width="18"
      height="18"
      rx="2"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
    <path
      class="tone-ink"
      d="M7 7h3.3v3.3H7zM13.7 7H17v3.3h-3.3zM10.3 10.3h3.4v3.4h-3.4zM7 13.7h3.3V17H7zM13.7 13.7H17V17h-3.3z"
      fill="currentColor"
      fill-opacity="0.4"
    />
  `, { tone: "coral" });

registerIcon("swap", svg`
    <path
      class="tone-ink"
      d="M20 11A8 8 0 0 0 5.6 6.6L4 8M4 3v5h5M4 13a8 8 0 0 0 14.4 4.4L20 16M20 21v-5h-5"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `, { tone: "teal" });

registerIcon("eyedropper", svg`
    <path
      class="tone-ink"
      d="M13.35 3.95l5.1 5.1M7.4 11.6 17.35 1.66a.85.85 0 0 1 1.19 0l2.21 2.21a.85.85 0 0 1 0 1.19L10.8 15H7.4v-3.4Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <rect class="tone-ink" x="2" y="18" width="4" height="4" fill="currentColor" />
  `, { tone: "pink" });

registerIcon("import", svg`
    <path
      class="tone-ink"
      d="M12 4v11M7.5 10.5 12 15l4.5-4.5"
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
      d="M12 15V4M7.5 8.5 12 4l4.5 4.5"
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
      class="tone-ink"
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
      class="tone-ink"
      d="M4 7h16"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
    <path
      class="tone-ink"
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
    <rect
      class="tone-ink"
      x="3"
      y="3"
      width="6"
      height="6"
      rx="1"
      transform="rotate(-12 6 6)"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
    <rect
      x="14"
      y="4"
      width="6"
      height="6"
      rx="1"
      transform="rotate(15 17 7)"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
    <path
      d="M7 14l3.5 6h-7Z"
      transform="rotate(8 7 17)"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linejoin="round"
    />
    <rect
      class="tone-ink"
      x="14"
      y="14"
      width="6"
      height="6"
      rx="1"
      transform="rotate(-8 17 17)"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
  `, { tone: "lime" });

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

registerIcon("ruler", svg`
    <rect
      x="2.5"
      y="7.5"
      width="19"
      height="9"
      rx="1.5"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
    <path
      class="tone-ink"
      d="M7 7.5v4M12 7.5v3M17 7.5v4"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
  `, { tone: "teal" });

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
    <path d="M7 10h10l-5 6Z" fill="currentColor" />
  `);

registerIcon("eyeOpen", svg`
    <path
      d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle class="tone-ink" cx="12" cy="12" r="3" fill="currentColor" />
  `, { tone: "sky" });

registerIcon("eyeOff", svg`
    <mask id="eye-off-slash-gap">
      <rect width="24" height="24" fill="#fff" />
      <path d="M4 2.5 21.5 20" stroke="#000" stroke-width="4.5" />
    </mask>
    <g mask="url(#eye-off-slash-gap)">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </g>
    <path
      class="tone-ink"
      d="M3 3l18 18"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
  `, { tone: "sky" });

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

export type TextGlyphName = keyof typeof kTextGlyphs;
export type GlyphName = IconName | TextGlyphName;

function isTextGlyph(
  name: GlyphName
): name is TextGlyphName {
  return Object.hasOwn(kTextGlyphs, name);
}

export function renderIcon(
  name: GlyphName
): TemplateResult {
  if (isTextGlyph(name)) {
    const { text, tone } = kTextGlyphs[name];

    return html`
      <span
        class="icon text-glyph"
        style="--jolly-icon-tone-color: var(--jolly-tone-${tone})"
        aria-hidden="true"
      >${text}</span>
    `;
  }

  return html`<jolly-icon class="icon" name=${name} aria-hidden="true"></jolly-icon>`;
}
