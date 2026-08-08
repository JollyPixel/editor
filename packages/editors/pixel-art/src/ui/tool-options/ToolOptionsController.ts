// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost
} from "lit";
import type {
  PixelArtCanvas,
  Mode
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { isInputElement } from "../../utils/dom.ts";

// CONSTANTS
const kBrushMin = 1;
const kBrushMax = 32;
const kPreviewDotMinPx = 6;
const kPreviewDotMaxPx = 22;

/**
 * Tool option state (mode, brush size, fill/select toggles, eyedropper).
 * Syncs with PixelArtCanvas directly; state re-read after each canvas call.
 */
export class ToolOptionsController implements ReactiveController {
  #host: ReactiveControllerHost;
  #canvas: PixelArtCanvas | null = null;

  #mode: Mode = "paint";
  #brushSize = 1;
  #fillGlobal = false;
  #selectShape = false;
  #pickColorArmed = false;

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    host.addController(this);
  }

  hostDisconnected(): void {
    this.#canvas = null;
  }

  get mode(): Mode {
    return this.#mode;
  }

  get pickColorArmed(): boolean {
    return this.#pickColorArmed;
  }

  get fillGlobal(): boolean {
    return this.#fillGlobal;
  }

  get selectShape(): boolean {
    return this.#selectShape;
  }

  attach(
    canvas: PixelArtCanvas
  ): void {
    this.#canvas = canvas;
    this.#mode = canvas.mode;
    this.#brushSize = canvas.brush.size;
    this.#fillGlobal = canvas.tools.fill.global;
    this.#selectShape = canvas.tools.select.shape;
    this.#pickColorArmed = canvas.tools.brush.pickArmed;
  }

  setMode(
    mode: Mode
  ): void {
    this.#mode = mode;
    if (this.#canvas) {
      this.#canvas.mode = mode;
      // Non-paint mode auto-disarms picker.
      this.#pickColorArmed = this.#canvas.tools.brush.pickArmed;
    }
    this.#host.requestUpdate();
  }

  /**
   * Force paint mode before toggling picker.
   */
  togglePickColor(): void {
    if (!this.#canvas) {
      return;
    }

    if (this.#mode !== "paint") {
      this.setMode("paint");
    }

    this.#canvas.tools.brush.pickArmed = !this.#canvas.tools.brush.pickArmed;
    this.#pickColorArmed = this.#canvas.tools.brush.pickArmed;
    this.#host.requestUpdate();
  }

  disarmPickColor(): void {
    this.#pickColorArmed = false;
  }

  #onBrushSizeChange(
    event: Event
  ): void {
    if (!isInputElement(event.target)) {
      return;
    }

    const value = parseInt(event.target.value, 10);
    this.#brushSize = value;
    if (this.#canvas) {
      this.#canvas.brush.size = value;
    }
    this.#host.requestUpdate();
  }

  setFillGlobal(
    value: boolean
  ): void {
    this.#fillGlobal = value;
    if (this.#canvas) {
      this.#canvas.tools.fill.global = value;
    }
    this.#host.requestUpdate();
  }

  setSelectShape(
    value: boolean
  ): void {
    this.#selectShape = value;
    if (this.#canvas) {
      this.#canvas.tools.select.shape = value;
    }
    this.#host.requestUpdate();
  }

  #renderPaint() {
    const fillPercent = ((this.#brushSize - kBrushMin) / (kBrushMax - kBrushMin)) * 100;
    const dotSizePx = kPreviewDotMinPx +
      ((this.#brushSize - kBrushMin) / (kBrushMax - kBrushMin) * (kPreviewDotMaxPx - kPreviewDotMinPx));

    return html`
      <div class="tool-option-overlay" part="brush-size-overlay">
        <span class="brush-preview" style="width: ${dotSizePx}px; height: ${dotSizePx}px"></span>
        <span class="tool-option-label">Size</span>
        <input
          class="brush-size-slider"
          type="range" min=${kBrushMin} max=${kBrushMax}
          .value=${String(this.#brushSize)}
          style="--fill: ${fillPercent}%"
          @input=${(event: Event) => this.#onBrushSizeChange(event)}
        >
        <span class="tool-option-value">${this.#brushSize}px</span>
      </div>
    `;
  }

  render() {
    return this.#mode === "paint" ? this.#renderPaint() : nothing;
  }
}
