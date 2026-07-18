// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions,
  type Mode
} from "../../../src/index.ts";
import { type ColorSwatch, type ColorChangeDetail } from "./ColorSwatch.ts";

@customElement("pixel-draw-panel")
export class PixelDrawPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .toolbar {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px 12px;
      padding: 6px 12px;
      background: #37474F;
      color: #eee;
      font-size: 12px;
      font-family: sans-serif;
      user-select: none;
      flex-shrink: 0;
    }

    .toolbar-item {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: default;
    }

    .mode-btn {
      padding: 3px 10px;
      border: 1px solid #555;
      border-radius: 3px;
      background: transparent;
      color: #aaa;
      font-size: 11px;
      font-family: sans-serif;
      cursor: pointer;
    }
    .mode-btn:hover {
      background: #3a3a3a;
      color: #eee;
    }
    .mode-btn.active {
      background: #4488ff;
      border-color: #4488ff;
      color: #fff;
    }

    .toolbar-item input[type="range"] {
      width: 80px;
      min-width: 48px;
      flex-shrink: 1;
      cursor: pointer;
    }

    .toolbar-item span {
      width: 32px;
      text-align: right;
      font-size: 11px;
      color: #ccc;
    }

    .canvas-host {
      flex: 1;
      position: relative;
      overflow: hidden;
      min-width: 0;
      min-height: 0;
    }
  `;

  // Plain private fields, not @state(): Lit's legacy decorators can't target
  // true #private fields (TS1206), so reactivity here is driven manually via
  // requestUpdate() instead of the decorator.
  #mode: Mode = "paint";
  #brushSize = 1;
  #zoomSensitivity = 0.6;
  #canvasManager: PixelArtCanvas | null = null;

  get canvasManager(): PixelArtCanvas | null {
    return this.#canvasManager;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener("colorpicked", this.#onColorPicked);
  }

  /**
   * Creates the PixelArtCanvas against this component's shadow DOM. Must be
   * called (and awaited) before the canvas/texture is usable, since the
   * canvas host only exists after the first Lit render.
   */
  async initialize(
    options: PixelArtCanvasOptions = {}
  ): Promise<PixelArtCanvas> {
    await this.updateComplete;

    const canvasHostEl = this.shadowRoot!.querySelector<HTMLDivElement>(".canvas-host")!;
    this.#canvasManager = new PixelArtCanvas(canvasHostEl, options);

    // Sync toolbar state with whatever defaults were passed in options.
    this.#mode = this.#canvasManager.mode;
    this.#brushSize = this.#canvasManager.brush.size;
    this.#zoomSensitivity = this.#canvasManager.zoomSensitivity;
    this.requestUpdate();

    return this.#canvasManager;
  }

  onResize(): void {
    this.#canvasManager?.onResize();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("colorpicked", this.#onColorPicked);
    this.#canvasManager?.destroy();
    this.#canvasManager = null;
  }

  #setMode(
    mode: Mode
  ): void {
    this.#mode = mode;
    if (this.#canvasManager) {
      this.#canvasManager.mode = mode;
    }
    this.requestUpdate();
  }

  #onBrushSizeChange(
    event: Event
  ): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.#brushSize = value;
    if (this.#canvasManager) {
      this.#canvasManager.brush.size = value;
    }
    this.requestUpdate();
  }

  #onZoomSensitivityChange(
    event: Event
  ): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.#zoomSensitivity = value;
    if (this.#canvasManager) {
      this.#canvasManager.zoomSensitivity = value;
    }
    this.requestUpdate();
  }

  #onColorSwatchChange(
    event: CustomEvent<ColorChangeDetail>
  ): void {
    const { hex, opacity } = event.detail;
    this.#canvasManager?.brush.color(hex, opacity);
  }

  /**
   * Mirrors a color picked via the canvas eyedropper (right-click) back onto
   * the color-swatch, without re-triggering its "color-change" event.
   */
  readonly #onColorPicked = (
    event: Event
  ): void => {
    const { hex, opacity } = (
      event as CustomEvent<{ hex: string; opacity: number; }>
    ).detail;

    this.shadowRoot!.querySelector<ColorSwatch>("color-swatch")!.setColor(hex, opacity);
  };

  override render() {
    return html`
      <div class="toolbar" part="toolbar">
        <div class="toolbar-item" role="group" aria-label="Drawing mode">
          <button
            class="mode-btn ${this.#mode === "paint" ? "active" : ""}"
            part="mode-button"
            aria-pressed=${this.#mode === "paint"}
            @click=${() => this.#setMode("paint")}
          >Paint</button>
          <button
            class="mode-btn ${this.#mode === "fill" ? "active" : ""}"
            part="mode-button"
            aria-pressed=${this.#mode === "fill"}
            @click=${() => this.#setMode("fill")}
          >Fill</button>
          <button
            class="mode-btn ${this.#mode === "move" ? "active" : ""}"
            part="mode-button"
            aria-pressed=${this.#mode === "move"}
            @click=${() => this.#setMode("move")}
          >Move</button>
          <button
            class="mode-btn ${this.#mode === "select" ? "active" : ""}"
            part="mode-button"
            aria-pressed=${this.#mode === "select"}
            @click=${() => this.#setMode("select")}
          >Select</button>
        </div>

        <div class="toolbar-item">
          <color-swatch @color-change=${this.#onColorSwatchChange}></color-swatch>
        </div>

        <label class="toolbar-item">
          Size
          <input
            type="range" min="1" max="32"
            .value=${String(this.#brushSize)}
            @input=${this.#onBrushSizeChange}
          >
          <span>${this.#brushSize}px</span>
        </label>

        <label class="toolbar-item">
          Zoom Sensitivity
          <input
            type="range" min="0.01" max="1" step="0.01"
            .value=${String(this.#zoomSensitivity)}
            @input=${this.#onZoomSensitivityChange}
          >
          <span>${this.#zoomSensitivity.toFixed(2)}</span>
        </label>
      </div>

      <div class="canvas-host" part="canvas-host"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pixel-draw-panel": PixelDrawPanel;
  }
}
