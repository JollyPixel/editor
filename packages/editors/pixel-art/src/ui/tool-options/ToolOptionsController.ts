// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost
} from "lit";
import { classMap } from "lit/directives/class-map.js";
import type {
  PixelArtCanvas,
  Mode
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { isInputElement } from "../../utils/dom.ts";

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

  #toggleFillGlobal(): void {
    this.#fillGlobal = !this.#fillGlobal;
    if (this.#canvas) {
      this.#canvas.tools.fill.global = this.#fillGlobal;
    }
    this.#host.requestUpdate();
  }

  #toggleSelectShape(): void {
    this.#selectShape = !this.#selectShape;
    if (this.#canvas) {
      this.#canvas.tools.select.shape = this.#selectShape;
    }
    this.#host.requestUpdate();
  }

  #renderPaint() {
    return html`
      <div class="tool-option-overlay" part="brush-size-overlay">
        Size
        <input
          type="range" min="1" max="32"
          .value=${String(this.#brushSize)}
          @input=${(event: Event) => this.#onBrushSizeChange(event)}
        >
        <span>${this.#brushSize}px</span>
      </div>
    `;
  }

  #renderFill() {
    return html`
      <div class="tool-option-overlay" part="fill-mode-overlay">
        <button
          class=${classMap({ "tool-toggle-btn": true, active: this.#fillGlobal })}
          aria-pressed=${this.#fillGlobal}
          @click=${() => this.#toggleFillGlobal()}
        >${this.#fillGlobal ? "Global" : "Neighbor"}</button>
      </div>
    `;
  }

  #renderSelect() {
    return html`
      <div class="tool-option-overlay" part="select-mode-overlay">
        <button
          class=${classMap({ "tool-toggle-btn": true, active: this.#selectShape })}
          aria-pressed=${this.#selectShape}
          @click=${() => this.#toggleSelectShape()}
        >${this.#selectShape ? "Shape" : "Rectangle"}</button>
      </div>
    `;
  }

  render() {
    switch (this.#mode) {
      case "paint":
        return this.#renderPaint();
      case "fill":
        return this.#renderFill();
      case "select":
        return this.#renderSelect();
      default:
        return nothing;
    }
  }
}
