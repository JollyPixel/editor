// Import Third-party Dependencies
import {
  LitElement,
  html
} from "lit";
import { customElement } from "lit/decorators.js";
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions,
  type Mode
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { ColorChangeDetail } from "../color/ColorSwatch.ts";
import { panelStyles } from "./PixelDrawPanel.styles.ts";
import { railButtonStyles } from "../mode-rail/rail-button.styles.ts";
import { iconStyles } from "../common/icon.styles.ts";
import { renderIcon } from "../common/icons.ts";
import { themeStyles } from "../theme.ts";
import { UvToolbarController } from "../uv/UvToolbarController.ts";
import { ToolOptionsController } from "../tool-options/ToolOptionsController.ts";
import { ColorController } from "../color/ColorController.ts";
import {
  assertElement,
  isInputElement
} from "../../utils/dom.ts";

// Side-effect imports: register custom elements.
import "../mode-rail/ModeRail.ts";
import "../color/ColorPickerRail.ts";

@customElement("pixel-draw-panel")
export class PixelDrawPanel extends LitElement {
  static override styles = [
    themeStyles,
    iconStyles,
    railButtonStyles,
    panelStyles
  ];

  // Not @state(): Lit can't decorate #private fields (TS1206); requestUpdate() drives rerenders.
  #canUndo = false;
  #canRedo = false;

  readonly #uvToolbar = new UvToolbarController(this);
  readonly #toolOptions = new ToolOptionsController(this);
  readonly #colors = new ColorController(this);

  #canvasManager: PixelArtCanvas | null = null;

  get canvasManager(): PixelArtCanvas | null {
    return this.#canvasManager;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener(
      "colorpicked",
      this.#onColorPicked
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener(
      "colorpicked",
      this.#onColorPicked
    );
    this.#canvasManager?.destroy();
    this.#canvasManager = null;
  }

  async initialize(
    options: PixelArtCanvasOptions = {}
  ): Promise<PixelArtCanvas> {
    await this.updateComplete;

    const canvasHostEl = assertElement(
      this.renderRoot.querySelector<HTMLDivElement>(".canvas-host"),
      "PixelDrawPanel: .canvas-host element not found"
    );
    this.#canvasManager = new PixelArtCanvas(canvasHostEl, {
      ...options,
      onHistoryChange: (state) => {
        this.#canUndo = state.canUndo;
        this.#canRedo = state.canRedo;
        this.requestUpdate();
        options.onHistoryChange?.(state);
      }
    });

    this.#toolOptions.attach(this.#canvasManager);
    this.#colors.attach(this.#canvasManager);
    this.#canUndo = this.#canvasManager.canUndo();
    this.#canRedo = this.#canvasManager.canRedo();
    this.#uvToolbar.attach(this.#canvasManager);
    this.requestUpdate();

    return this.#canvasManager;
  }

  onResize(): void {
    this.#canvasManager?.onResize();
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

    const url = this.#canvasManager
      .textureCanvas()
      .toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "texture.png";
    anchor.click();
  }

  #onImportClick(): void {
    const fileInput = assertElement(
      this.renderRoot.querySelector<HTMLInputElement>(".file-input"),
      "PixelDrawPanel: .file-input element not found"
    );
    fileInput.value = "";
    fileInput.click();
  }

  #onImportFileSelected(
    event: Event
  ): void {
    if (!isInputElement(event.target) || !this.#canvasManager) {
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const canvasManager = this.#canvasManager;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      canvasManager.texture = image;
      canvasManager.centerTexture();
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }

  /**
    * A pick spans two controllers: color state and picker-armed state.
   */
  readonly #onColorPicked = (
    event: CustomEvent<ColorChangeDetail>
  ): void => {
    this.#colors.onColorPicked(event.detail);
    this.#toolOptions.disarmPickColor();
    this.requestUpdate();
  };

  override render() {
    return html`
      <div class="rail" part="rail">
        <mode-rail
          .mode=${this.#toolOptions.mode}
          .pickColorArmed=${this.#toolOptions.pickColorArmed}
          @mode-change=${(event: CustomEvent<Mode>) => this.#toolOptions.setMode(event.detail)}
          @pick-color-toggle=${() => this.#toolOptions.togglePickColor()}
        ></mode-rail>

        <div class="rail-divider"></div>

        <color-picker-rail
          part="color-picker"
          .foreground=${this.#colors.foreground}
          .background=${this.#colors.background}
          @foreground-change=${(event: CustomEvent<ColorChangeDetail>) => this.#colors.onForegroundChange(event)}
          @background-change=${(event: CustomEvent<ColorChangeDetail>) => this.#colors.onBackgroundChange(event)}
          @swap=${() => this.#colors.swap()}
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
        ${this.#toolOptions.render()}
        ${this.#uvToolbar.render(this.#toolOptions.mode === "uv")}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pixel-draw-panel": PixelDrawPanel;
  }

  interface HTMLElementEventMap {
    colorpicked: CustomEvent<ColorChangeDetail>;
  }
}
