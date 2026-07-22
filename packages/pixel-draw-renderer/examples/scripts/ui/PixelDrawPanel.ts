// Import Third-party Dependencies
import { LitElement, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions,
  type Mode
} from "../../../src/index.ts";
import { type ColorChangeDetail } from "./ColorSwatch.ts";
import { panelStyles } from "./PixelDrawPanel.styles.ts";
import { railButtonStyles } from "./rail-button.styles.ts";
import { iconStyles } from "./icon.styles.ts";
import { renderIcon } from "./icons.ts";

// Bare imports: only used via their custom element tags below, so nothing
// here needs a named binding — but the module still has to run once to
// register the element (verbatimModuleSyntax erases type-only imports).
import "./ModeRail.ts";
import "./ColorPickerRail.ts";

// Fixed creation size for the demo's "Create" button; the library itself
// takes an arbitrary width/height via `uv.create({ width, height })`.
const kUvCreateSize = { width: 16, height: 16 };

@customElement("pixel-draw-panel")
export class PixelDrawPanel extends LitElement {
  static override styles = [iconStyles, railButtonStyles, panelStyles];

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
  }

  #onUndo(): void {
    this.#canvasManager?.undo();
  }

  #onRedo(): void {
    this.#canvasManager?.redo();
  }

  #onExportPng(): void {
    if (!this.#canvasManager) {
      return;
    }

    const url = this.#canvasManager.textureCanvas().toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "texture.png";
    anchor.click();
  }

  #onImportClick(): void {
    const fileInput = this.shadowRoot!.querySelector<HTMLInputElement>(".file-input")!;
    fileInput.value = "";
    fileInput.click();
  }

  #onImportFileSelected(
    event: Event
  ): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.#canvasManager) {
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      this.#canvasManager!.texture = image;
      this.#canvasManager!.centerTexture();
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }

  /**
   * Mirrors a color picked via the canvas eyedropper onto the foreground
   * swatch. The picker auto-disarms itself on the canvas side after a
   * successful pick, so the toggle button's active state is resynced here
   * too. <color-picker-rail> picks up the new foreground from its prop
   * binding and pushes it into its swatch on its next update.
   */
  readonly #onColorPicked = (
    event: Event
  ): void => {
    const { hex, opacity } = (
      event as CustomEvent<ColorChangeDetail>
    ).detail;

    this.#foreground = { hex, opacity };
    this.#pickColorArmed = false;
    this.requestUpdate();
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
        <mode-rail
          .mode=${this.#mode}
          .pickColorArmed=${this.#pickColorArmed}
          @mode-change=${(event: CustomEvent<Mode>) => this.#setMode(event.detail)}
          @pick-color-toggle=${() => this.#onPickColorToggle()}
        ></mode-rail>

        <div class="rail-divider"></div>

        <color-picker-rail
          part="color-picker"
          .foreground=${this.#foreground}
          .background=${this.#background}
          @foreground-change=${this.#onForegroundChange}
          @background-change=${this.#onBackgroundChange}
          @swap=${() => this.#swapColors()}
        ></color-picker-rail>

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

        <div class="rail-divider"></div>

        <div class="rail-section" role="group" aria-label="File">
          <button
            class="rail-btn" part="import-button"
            aria-label="Import texture"
            @click=${this.#onImportClick}
          >
            ${renderIcon("import")}
            <span class="tooltip">Import</span>
          </button>
          <button
            class="rail-btn" part="export-button"
            aria-label="Export texture"
            @click=${this.#onExportPng}
          >
            ${renderIcon("export")}
            <span class="tooltip">Export</span>
          </button>
        </div>
      </div>

      <input
        class="file-input" part="file-input"
        type="file" accept="image/png,image/*"
        @change=${this.#onImportFileSelected}
      >

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
