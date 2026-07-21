// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions,
  type Mode
} from "../../../src/index.ts";
import { type ColorSwatch, type ColorChangeDetail } from "./ColorSwatch.ts";
import { renderIcon, type IconName } from "./icons.ts";

// CONSTANTS
const kModeItems: { mode: Mode; icon: IconName; label: string; }[] = [
  { mode: "move", icon: "move", label: "Move" },
  { mode: "paint", icon: "paint", label: "Paint" },
  { mode: "fill", icon: "fill", label: "Fill" },
  { mode: "select", icon: "select", label: "Select" },
  { mode: "uv", icon: "uv", label: "UV" }
];

// Fixed creation size for the demo's "Create" button; the library itself
// takes an arbitrary width/height via `uv.create({ width, height })`.
const kUvCreateSize = { width: 16, height: 16 };

@customElement("pixel-draw-panel")
export class PixelDrawPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: row;
      height: 100%;
    }

    .rail {
      position: relative;
      z-index: 3;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 60px;
      flex-shrink: 0;
      padding: 10px 0;
      gap: 10px;
      background: #37474F;
      color: #eee;
      font-family: sans-serif;
      user-select: none;
    }

    .rail-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-shrink: 0;
      gap: 4px;
    }

    .rail-divider {
      width: 32px;
      height: 1px;
      flex-shrink: 0;
      background: #4b5b63;
    }

    .rail-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      color: #ccc;
      cursor: pointer;
    }
    .rail-btn:hover:not(:disabled) {
      color: #fff;
    }
    .rail-btn.active {
      background: #4488ff;
      border-color: #4488ff;
      color: #fff;
    }
    .rail-btn:disabled {
      color: #556067;
      cursor: default;
    }

    .icon {
      width: 21px;
      height: 21px;
      flex-shrink: 0;
    }
    .swap-btn .icon {
      width: 11px;
      height: 11px;
    }

    .tooltip {
      position: absolute;
      left: calc(100% + 8px);
      top: 50%;
      z-index: 10;
      padding: 3px 8px;
      border-radius: 3px;
      background: #1d262b;
      color: #eee;
      font-size: 11px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-50%);
      transition: opacity 0.1s ease;
    }
    .rail-btn:hover .tooltip {
      opacity: 1;
      visibility: visible;
    }

    .color-picker {
      /*
       * Self-contained box: fg/bg swatches and the swap button all stay
       * within these bounds (no negative offsets), so the rail's own gap
       * is the true, symmetric visual spacing above/below this element.
       * flex-shrink:0 matters here specifically: its children are all
       * position:absolute, so it has ~0 natural content height and would
       * otherwise be the first thing the flex column crushes when the rail
       * runs short on vertical space, leaving the swatches anchored to a
       * collapsed box and overlapped by neighboring elements.
       */
      position: relative;
      flex-shrink: 0;
      width: 44px;
      height: 44px;
    }

    .color-picker .swatch {
      position: absolute;
    }
    .color-picker .swatch.fg {
      top: 4px;
      left: 0;
      z-index: 2;
    }
    .color-picker .swatch.bg {
      right: 0;
      bottom: 0;
      z-index: 1;
    }
    .color-picker .swatch::part(swatch) {
      width: 24px;
      height: 24px;
    }

    .swap-btn {
      position: absolute;
      top: 0;
      right: 0;
      z-index: 3;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: #546b76;
      color: #fff;
      font-size: 9px;
      line-height: 1;
      cursor: pointer;
    }
    .swap-btn:hover {
      background: #4488ff;
    }

    .stage {
      position: relative;
      flex: 1;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    .canvas-host {
      /*
       * PixelArtCanvas.appendTo() sets this element's position to "relative"
       * inline (higher specificity than this stylesheet), so sizing must
       * come from width/height, not position:absolute + inset.
       */
      width: 100%;
      height: 100%;
    }

    .tool-option-overlay {
      position: absolute;
      top: 8px;
      left: 50%;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 12px;
      background: rgba(30, 38, 43, 0.85);
      color: #eee;
      font-size: 11px;
      font-family: sans-serif;
      user-select: none;
      transform: translateX(-50%);
    }

    .tool-option-overlay input[type="range"] {
      width: 100px;
      cursor: pointer;
    }

    .tool-option-overlay span {
      width: 28px;
      text-align: right;
    }

    .tool-toggle-btn {
      padding: 2px 8px;
      border: 1px solid #556067;
      border-radius: 10px;
      background: transparent;
      color: #eee;
      font-size: 11px;
      cursor: pointer;
    }
    .tool-toggle-btn.active {
      background: #4488ff;
      border-color: #4488ff;
    }

    .uv-toolbar {
      position: absolute;
      bottom: 8px;
      left: 50%;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      border-radius: 12px;
      background: rgba(30, 38, 43, 0.85);
      color: #eee;
      font-size: 11px;
      font-family: sans-serif;
      user-select: none;
      transform: translateX(-50%);
    }

    .uv-toolbar button {
      padding: 3px 10px;
      border: 1px solid #556067;
      border-radius: 10px;
      background: transparent;
      color: #eee;
      font-size: 11px;
      cursor: pointer;
    }
    .uv-toolbar button:disabled {
      color: #556067;
      cursor: default;
    }

    .uv-toolbar label {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
    }
  `;

  // Plain private fields, not @state(): Lit's legacy decorators can't target
  // true #private fields (TS1206), so reactivity here is driven manually via
  // requestUpdate() instead of the decorator.
  #mode: Mode = "paint";
  #brushSize = 1;
  #fillGlobal = false;
  #selectShape = false;
  #pickColorArmed = false;
  #foreground: ColorChangeDetail = { hex: "#000000", opacity: 1 };
  #background: ColorChangeDetail = { hex: "#ffffff", opacity: 1 };
  #canUndo = false;
  #canRedo = false;
  #uvSelectedRegionId: string | null = null;
  #uvShowAll = false;
  #canvasManager: PixelArtCanvas | null = null;

  get canvasManager(): PixelArtCanvas | null {
    return this.#canvasManager;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener("colorpicked", this.#onColorPicked);
    this.addEventListener("swatch-opened", this.#onSwatchOpened);
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
    this.#canvasManager = new PixelArtCanvas(canvasHostEl, {
      ...options,
      onHistoryChange: (state) => {
        this.#canUndo = state.canUndo;
        this.#canRedo = state.canRedo;
        this.requestUpdate();
        options.onHistoryChange?.(state);
      }
    });

    // Sync rail state with whatever defaults were passed in options.
    this.#mode = this.#canvasManager.mode;
    this.#brushSize = this.#canvasManager.brush.size;
    this.#fillGlobal = this.#canvasManager.tools.fill.global;
    this.#selectShape = this.#canvasManager.tools.select.shape;
    this.#pickColorArmed = this.#canvasManager.tools.brush.pickArmed;
    this.#foreground = {
      hex: this.#canvasManager.brush.primary.asString("hex"),
      opacity: this.#canvasManager.brush.primary.opacity
    };
    this.#background = {
      hex: this.#canvasManager.brush.secondary.asString("hex"),
      opacity: this.#canvasManager.brush.secondary.opacity
    };
    this.#canUndo = this.#canvasManager.canUndo();
    this.#canRedo = this.#canvasManager.canRedo();
    this.#uvSelectedRegionId = this.#canvasManager.uv.selectedRegionId;
    this.#uvShowAll = this.#canvasManager.uv.showAll;
    this.#canvasManager.uv.on("selection-changed", ({ selectedRegionId }) => {
      this.#uvSelectedRegionId = selectedRegionId;
      this.requestUpdate();
    });
    this.#canvasManager.uv.on("visibility-changed", ({ showAll }) => {
      this.#uvShowAll = showAll;
      this.requestUpdate();
    });
    this.requestUpdate();
    this.#syncForegroundSwatch();
    this.#syncBackgroundSwatch();

    return this.#canvasManager;
  }

  onResize(): void {
    this.#canvasManager?.onResize();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("colorpicked", this.#onColorPicked);
    this.removeEventListener("swatch-opened", this.#onSwatchOpened);
    this.#canvasManager?.destroy();
    this.#canvasManager = null;
  }

  #setMode(
    mode: Mode
  ): void {
    this.#mode = mode;
    if (this.#canvasManager) {
      this.#canvasManager.mode = mode;
      // Leaving paint mode auto-disarms the picker on the canvas side; keep
      // the toggle button's active state in sync with that.
      this.#pickColorArmed = this.#canvasManager.tools.brush.pickArmed;
    }
    this.requestUpdate();
  }

  /**
   * Always forces paint mode first, so the picker predictably arms/disarms
   * no matter which mode was active when the button was clicked.
   */
  #onPickColorToggle(): void {
    if (!this.#canvasManager) {
      return;
    }

    if (this.#mode !== "paint") {
      this.#setMode("paint");
    }

    this.#canvasManager.tools.brush.pickArmed = !this.#canvasManager.tools.brush.pickArmed;
    this.#pickColorArmed = this.#canvasManager.tools.brush.pickArmed;
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

  #onFillGlobalToggle(): void {
    this.#fillGlobal = !this.#fillGlobal;
    if (this.#canvasManager) {
      this.#canvasManager.tools.fill.global = this.#fillGlobal;
    }
    this.requestUpdate();
  }

  #onSelectShapeToggle(): void {
    this.#selectShape = !this.#selectShape;
    if (this.#canvasManager) {
      this.#canvasManager.tools.select.shape = this.#selectShape;
    }
    this.requestUpdate();
  }

  #onUvCreate(): void {
    this.#canvasManager?.uv.create(kUvCreateSize);
  }

  #onUvDelete(): void {
    if (this.#uvSelectedRegionId) {
      this.#canvasManager?.uv.delete(this.#uvSelectedRegionId);
    }
  }

  #onUvShowAllToggle(): void {
    if (this.#canvasManager) {
      this.#canvasManager.uv.showAll = !this.#canvasManager.uv.showAll;
    }
  }

  #onForegroundChange(
    event: CustomEvent<ColorChangeDetail>
  ): void {
    this.#foreground = event.detail;
    this.#canvasManager?.brush.primary.set(event.detail.hex, event.detail.opacity);
  }

  #onBackgroundChange(
    event: CustomEvent<ColorChangeDetail>
  ): void {
    this.#background = event.detail;
    this.#canvasManager?.brush.secondary.set(event.detail.hex, event.detail.opacity);
  }

  /**
   * Exchanges foreground/background on both the panel's swatches and the
   * brush's primary/secondary colors.
   */
  #swapColors(): void {
    [this.#foreground, this.#background] = [this.#background, this.#foreground];
    this.#canvasManager?.brush.swapColors();
    this.requestUpdate();
    this.#syncForegroundSwatch();
    this.#syncBackgroundSwatch();
  }

  /**
   * ColorSwatch only paints its swatch/picker from `color`/`opacity` in
   * firstUpdated() — later property changes made from here need an explicit
   * setColor() to actually repaint it (mirrors #onColorPicked below).
   */
  #syncForegroundSwatch(): void {
    this.shadowRoot?.querySelector<ColorSwatch>("color-swatch.fg")
      ?.setColor(this.#foreground.hex, this.#foreground.opacity);
  }

  #syncBackgroundSwatch(): void {
    this.shadowRoot?.querySelector<ColorSwatch>("color-swatch.bg")
      ?.setColor(this.#background.hex, this.#background.opacity);
  }

  #onUndo(): void {
    this.#canvasManager?.undo();
  }

  #onRedo(): void {
    this.#canvasManager?.redo();
  }

  /**
   * Mirrors a color picked via the canvas eyedropper onto the foreground
   * swatch, without re-triggering its "color-change" event. The picker
   * auto-disarms itself on the canvas side after a successful pick, so the
   * toggle button's active state is resynced here too.
   */
  readonly #onColorPicked = (
    event: Event
  ): void => {
    const { hex, opacity } = (
      event as CustomEvent<ColorChangeDetail>
    ).detail;

    this.#foreground = { hex, opacity };
    this.#pickColorArmed = false;
    this.shadowRoot!.querySelector<ColorSwatch>("color-swatch.fg")!.setColor(hex, opacity);
    this.requestUpdate();
  };

  /**
   * Closes the sibling swatch so foreground/background pickers can't both be
   * open. Crossing the color-swatch's shadow boundary retargets event.target
   * to this panel itself, so composedPath()[0] is used to find the actual
   * swatch that opened.
   */
  readonly #onSwatchOpened = (
    event: Event
  ): void => {
    const opened = event.composedPath()[0];
    for (const swatch of this.shadowRoot!.querySelectorAll<ColorSwatch>("color-swatch")) {
      if (swatch !== opened) {
        swatch.close();
      }
    }
  };

  #renderToolOptions() {
    if (this.#mode === "paint") {
      return html`
        <div class="tool-option-overlay" part="brush-size-overlay">
          Size
          <input
            type="range" min="1" max="32"
            .value=${String(this.#brushSize)}
            @input=${this.#onBrushSizeChange}
          >
          <span>${this.#brushSize}px</span>
        </div>
      `;
    }

    if (this.#mode === "fill") {
      return html`
        <div class="tool-option-overlay" part="fill-mode-overlay">
          <button
            class="tool-toggle-btn ${this.#fillGlobal ? "active" : ""}"
            aria-pressed=${this.#fillGlobal}
            @click=${this.#onFillGlobalToggle}
          >${this.#fillGlobal ? "Global" : "Neighbor"}</button>
        </div>
      `;
    }

    if (this.#mode === "select") {
      return html`
        <div class="tool-option-overlay" part="select-mode-overlay">
          <button
            class="tool-toggle-btn ${this.#selectShape ? "active" : ""}"
            aria-pressed=${this.#selectShape}
            @click=${this.#onSelectShapeToggle}
          >${this.#selectShape ? "Shape" : "Rectangle"}</button>
        </div>
      `;
    }

    return nothing;
  }

  #renderUVToolbar() {
    if (this.#mode !== "uv") {
      return nothing;
    }

    return html`
      <div class="uv-toolbar" part="uv-toolbar">
        <button @click=${this.#onUvCreate}>Create</button>
        <button ?disabled=${!this.#uvSelectedRegionId} @click=${this.#onUvDelete}>Delete</button>
        <label>
          <input type="checkbox" .checked=${this.#uvShowAll} @change=${this.#onUvShowAllToggle}>
          Show all
        </label>
      </div>
    `;
  }

  override render() {
    return html`
      <div class="rail" part="rail">
        <div class="rail-section" role="group" aria-label="Drawing mode">
          ${kModeItems.map(({ mode, icon, label }) => html`
            <button
              class="rail-btn ${this.#mode === mode ? "active" : ""}"
              part="mode-button"
              aria-label=${label}
              aria-pressed=${this.#mode === mode}
              @click=${() => this.#setMode(mode)}
            >
              ${renderIcon(icon)}
              <span class="tooltip">${label}</span>
            </button>
            ${mode === "paint" ? html`
              <button
                class="rail-btn ${this.#pickColorArmed ? "active" : ""}"
                part="pick-color-button"
                aria-label="Pick color"
                aria-pressed=${this.#pickColorArmed}
                @click=${() => this.#onPickColorToggle()}
              >
                ${renderIcon("eyedropper")}
                <span class="tooltip">Pick color</span>
              </button>
            ` : nothing}
          `)}
        </div>

        <div class="rail-divider"></div>

        <div class="color-picker" part="color-picker">
          <color-swatch
            class="swatch fg" part="fg-swatch"
            .color=${this.#foreground.hex} .opacity=${this.#foreground.opacity}
            @color-change=${this.#onForegroundChange}
          ></color-swatch>
          <color-swatch
            class="swatch bg" part="bg-swatch"
            .color=${this.#background.hex} .opacity=${this.#background.opacity}
            @color-change=${this.#onBackgroundChange}
          ></color-swatch>
          <button
            class="swap-btn" part="swap-button"
            aria-label="Swap foreground and background colors"
            @click=${this.#swapColors}
          >${renderIcon("swap")}</button>
        </div>

        <div class="rail-divider"></div>

        <div class="rail-section" role="group" aria-label="History">
          <button
            class="rail-btn" part="undo-button"
            aria-label="Undo"
            ?disabled=${!this.#canUndo}
            @click=${this.#onUndo}
          >
            ${renderIcon("undo")}
            <span class="tooltip">Undo</span>
          </button>
          <button
            class="rail-btn" part="redo-button"
            aria-label="Redo"
            ?disabled=${!this.#canRedo}
            @click=${this.#onRedo}
          >
            ${renderIcon("redo")}
            <span class="tooltip">Redo</span>
          </button>
        </div>
      </div>

      <div class="stage" part="stage">
        <div class="canvas-host" part="canvas-host"></div>
        ${this.#renderToolOptions()}
        ${this.#renderUVToolbar()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pixel-draw-panel": PixelDrawPanel;
  }
}
