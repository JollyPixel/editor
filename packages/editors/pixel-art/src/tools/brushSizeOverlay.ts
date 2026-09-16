// Import Third-party Dependencies
import { html } from "lit";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { isInputElement } from "../shared/dom.ts";

// CONSTANTS
const kBrushMin = 1;
const kBrushMax = 32;
const kPreviewDotMinPx = 6;
const kPreviewDotMaxPx = 22;

export function renderBrushSizeOverlay(
  canvas: PixelArtCanvas,
  onResize: () => void
) {
  const size = canvas.brush.size;
  const ratio = (size - kBrushMin) / (kBrushMax - kBrushMin);
  const dotSizePx = kPreviewDotMinPx + (ratio * (kPreviewDotMaxPx - kPreviewDotMinPx));

  function onInput(
    event: Event
  ): void {
    if (isInputElement(event.target)) {
      canvas.brush.size = parseInt(event.target.value, 10);
      onResize();
    }
  }

  return html`
    <div class="tool-option-overlay" part="brush-size-overlay">
      <span class="brush-preview" style="width: ${dotSizePx}px; height: ${dotSizePx}px"></span>
      <span class="tool-option-label">Size</span>
      <input
        class="brush-size-slider"
        type="range" min=${kBrushMin} max=${kBrushMax}
        .value=${String(size)}
        style="--fill: ${ratio * 100}%"
        @input=${onInput}
      >
      <span class="tool-option-value">${size}px</span>
    </div>
  `;
}
