// Import Third-party Dependencies
import { html } from "lit";
import type {
  BrushInkName,
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kInks: readonly { name: BrushInkName; label: string; title: string; }[] = [
  {
    name: "blend",
    label: "Blend",
    title: "Blend translucent colors with the pixels under them"
  },
  {
    name: "replace",
    label: "Replace",
    title: "Write the color and its alpha as they are"
  },
  {
    name: "lock-alpha",
    label: "Lock alpha",
    title: "Tint visible pixels and keep their alpha"
  }
];

export function renderInkOverlay(
  canvas: PixelArtCanvas,
  onChange: () => void
) {
  const { brush } = canvas;

  return html`
    <div
      class="tool-option-overlay ink-overlay"
      part="ink-overlay"
      role="group"
      aria-label="Brush ink"
    >
      <span class="tool-option-label">Ink</span>
      ${kInks.map((ink) => html`
        <button
          type="button"
          class="ink-option"
          part="ink-option"
          title=${ink.title}
          aria-pressed=${brush.ink === ink.name ? "true" : "false"}
          @click=${() => {
            brush.ink = ink.name;
            onChange();
          }}
        >${ink.label}</button>
      `)}
    </div>
  `;
}
