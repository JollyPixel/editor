// Import Third-party Dependencies
import {
  html,
  type ReactiveController,
  type ReactiveControllerHost
} from "lit";
import { ref, createRef, type Ref } from "lit/directives/ref.js";
import type {
  PixelArtCanvas,
  HistoryState
} from "@jolly-pixel/pixel-draw.renderer";
import { encodePng } from "@jolly-pixel/image";
import { decodeRasterCanvas } from "@jolly-pixel/image/raster";

// Import Internal Dependencies
import { renderIcon } from "../common/icons.ts";
import { isInputElement } from "../../utils/dom.ts";

/**
 * Undo/redo + import/export texture. Visible across every mode (unlike the
 * mode-scoped tool-option and UV overlays), so it renders unconditionally
 * at the bottom of the stage.
 */
export class HistoryFileToolbarController implements ReactiveController {
  #host: ReactiveControllerHost;
  #canvas: PixelArtCanvas | null = null;

  #canUndo = false;
  #canRedo = false;

  readonly #fileInputRef: Ref<HTMLInputElement> = createRef();

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    host.addController(this);
  }

  hostDisconnected(): void {
    this.#canvas = null;
  }

  attach(
    canvas: PixelArtCanvas
  ): void {
    this.#canvas = canvas;
    this.#canUndo = canvas.canUndo();
    this.#canRedo = canvas.canRedo();
  }

  /**
   * PixelArtCanvas reports history state through the onHistoryChange
   * constructor option rather than an event emitter; the host forwards it.
   */
  onHistoryChange(
    state: HistoryState
  ): void {
    this.#canUndo = state.canUndo;
    this.#canRedo = state.canRedo;
    this.#host.requestUpdate();
  }

  undo(): void {
    this.#canvas?.undo();
  }

  redo(): void {
    this.#canvas?.redo();
  }

  clearTexture(): void {
    if (!this.#canvas) {
      return;
    }

    const size = this.#canvas.textureSize;
    const blank = document.createElement("canvas");
    blank.width = size.x;
    blank.height = size.y;
    this.#canvas.texture = blank;
  }

  /**
   * Reads the texture's own samples and encodes them directly. `toDataURL`
   * would go through the canvas backing store, which premultiplies, so
   * low-alpha pixels would not survive the export.
   */
  async #onExportPng(): Promise<void> {
    if (!this.#canvas) {
      return;
    }

    const canvas = this.#canvas.textureCanvas();
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return;
    }

    const { data } = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
    const png = await encodePng({
      width: canvas.width,
      height: canvas.height,
      data
    });

    const url = URL.createObjectURL(
      new Blob([png], { type: "image/png" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "texture.png";
    anchor.click();

    // Revoking synchronously cancels the download on some browsers, which
    // have not read the URL by the time click() returns.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  #onImportClick(): void {
    const fileInput = this.#fileInputRef.value;
    if (!fileInput) {
      return;
    }

    fileInput.value = "";
    fileInput.click();
  }

  async #onImportFileSelected(
    event: Event
  ): Promise<void> {
    if (!isInputElement(event.target) || !this.#canvas) {
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const canvas = this.#canvas;
    let source: HTMLCanvasElement;
    try {
      source = await decodeRasterCanvas(file);
    }
    catch {
      return;
    }
    if (this.#canvas !== canvas) {
      return;
    }

    canvas.texture = source;
    canvas.centerTexture();
  }

  render() {
    return html`
      <div class="overlay-toolbar bottom" part="history-file-toolbar">
        <button
          class="rail-btn" part="undo-button"
          aria-label="Undo"
          ?disabled=${!this.#canUndo}
          @click=${() => this.undo()}
        >
          ${renderIcon("undo")}
          <span class="tooltip">Undo</span>
        </button>
        <button
          class="rail-btn" part="redo-button"
          aria-label="Redo"
          ?disabled=${!this.#canRedo}
          @click=${() => this.redo()}
        >
          ${renderIcon("redo")}
          <span class="tooltip">Redo</span>
        </button>
        <div class="overlay-toolbar-divider"></div>
        <button
          class="rail-btn" part="import-button"
          aria-label="Import texture"
          @click=${() => this.#onImportClick()}
        >
          ${renderIcon("import")}
          <span class="tooltip">Import</span>
        </button>
        <button
          class="rail-btn" part="export-button"
          aria-label="Export texture"
          @click=${() => void this.#onExportPng()}
        >
          ${renderIcon("export")}
          <span class="tooltip">Export</span>
        </button>
        <div class="overlay-toolbar-divider"></div>
        <button
          class="rail-btn" part="clear-texture-button"
          aria-label="Clear texture"
          @click=${() => this.clearTexture()}
        >
          ${renderIcon("clearTexture")}
          <span class="tooltip">Clear texture</span>
        </button>
        <input
          class="file-input" part="file-input"
          type="file" accept="image/png,image/*"
          ${ref(this.#fileInputRef)}
          @change=${(event: Event) => void this.#onImportFileSelected(event)}
        >
      </div>
    `;
  }
}
