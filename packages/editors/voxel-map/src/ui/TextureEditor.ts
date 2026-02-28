// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import Picker from "vanilla-picker";
import type { VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { TextureEditorBridge } from "../lib/TextureEditorBridge.ts";
import type { EventSelect } from "./types.ts";

@customElement("texture-editor")
export class TextureEditor extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 8px;
      background: #0e1316;
      border-bottom: 1px solid #1e2a30;
      flex-shrink: 0;
      flex-wrap: wrap;
    }

    .toolbar label {
      font-size: 11px;
      color: #888;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .toolbar button {
      background: #1a2228;
      border: 1px solid #2a3540;
      color: #aaa;
      padding: 2px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    }
    .toolbar button:hover {
      background: #243040;
      color: #ccc;
    }
    .toolbar button.active {
      background: #1a3a5a;
      border-color: #4488ff;
      color: #4488ff;
    }

    .toolbar input[type="number"] {
      width: 40px;
      background: #111a20;
      border: 1px solid #333;
      color: #eee;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 11px;
    }

    .toolbar select {
      background: #111a20;
      border: 1px solid #333;
      color: #eee;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 11px;
      max-width: 100px;
    }

    .color-swatch {
      width: 26px;
      height: 22px;
      padding: 0;
      border: 1px solid #333;
      border-radius: 3px;
      background: #000;
      cursor: pointer;
      flex-shrink: 0;
    }

    .canvas-host {
      flex: 1;
      min-height: 350px;
      position: relative;
      overflow: hidden;
      background: #0a1015;
    }
  `;

  @property({ attribute: false }) declare vr: VoxelRenderer | undefined;
  @property({ type: String }) declare tilesetId: string;
  @property({ type: Boolean }) declare active: boolean;

  @state() private declare _mode: Mode;
  @state() private declare _brushSize: number;

  readonly #bridge = new TextureEditorBridge();
  #canvasHost: HTMLDivElement | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #picker: Picker | null = null;
  #pickerPortal: HTMLDivElement | null = null;
  #swatchEl: HTMLButtonElement | null = null;
  #swatchClickHandler: ((e: MouseEvent) => void) | null = null;
  #outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor() {
    super();
    this.tilesetId = "";
    this.active = false;
    this._mode = "paint";
    this._brushSize = 1;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener("colorpicked", this.#onColorPicked);
  }

  override firstUpdated() {
    this.#canvasHost = this.shadowRoot!.querySelector<HTMLDivElement>(".canvas-host")!;

    this.#bridge.mount(this.#canvasHost, {
      defaultMode: this._mode,
      zoom: {
        default: 1,
        min: 1,
        max: 32,
        sensitivity: 0.6
      },
      brush: {
        size: this._brushSize,
        color: "#000000"
      },
      texture: {
        maxSize: 512
      }
    });

    if (this.vr) {
      this.#bridge.loadTileset(this.vr, this.tilesetId || null);
    }

    // Portal: vanilla-picker injects CSS into <head>, which doesn't pierce
    // Shadow DOM. Appending to document.body keeps it in the regular DOM
    // where those styles apply.
    const portal = document.createElement("div");
    portal.style.cssText = "position:fixed;z-index:9999;display:none;";
    document.body.appendChild(portal);
    this.#pickerPortal = portal;

    const swatchEl = this.shadowRoot!.querySelector<HTMLButtonElement>(".color-swatch")!;
    this.#swatchEl = swatchEl;

    this.#picker = new Picker({
      parent: portal,
      popup: false,
      alpha: true,
      editor: true,
      editorFormat: "hex",
      color: "#000000ff",
      onChange: (color) => {
        const hex = color.hex.slice(0, 7);
        const alpha = color.rgba[3];
        this.#bridge.setBrushColor(hex, alpha);
        swatchEl.style.background = color.rgbaString;
      }
    });

    function swatchClickHandler(event: MouseEvent) {
      // stopPropagation prevents the document click handler from immediately
      // closing the portal on the same event tick.
      event.stopPropagation();
      if (portal.style.display === "none") {
        const rect = swatchEl.getBoundingClientRect();
        portal.style.left = `${rect.left}px`;
        portal.style.top = `${rect.bottom + 4}px`;
        portal.style.display = "";
      }
      else {
        portal.style.display = "none";
      }
    }
    swatchEl.addEventListener("click", swatchClickHandler);
    this.#swatchClickHandler = swatchClickHandler;

    function outsideClickHandler(event: MouseEvent) {
      const path = event.composedPath();
      if (!path.includes(portal) && !path.includes(swatchEl)) {
        portal.style.display = "none";
      }
    }
    document.addEventListener("click", outsideClickHandler);
    this.#outsideClickHandler = outsideClickHandler;

    this.#resizeObserver = new ResizeObserver(() => this.#bridge.onResize());
    this.#resizeObserver.observe(this.#canvasHost);
  }

  override updated(
    changed: Map<string, unknown>
  ) {
    if (!this.#bridge.isActive) {
      return;
    }

    if (changed.has("active") && this.active) {
      this.#bridge.onResize();
    }

    if ((changed.has("vr") || changed.has("tilesetId")) && this.vr) {
      this.#bridge.loadTileset(this.vr, this.tilesetId || null);
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("colorpicked", this.#onColorPicked);
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    if (this.#swatchClickHandler && this.#swatchEl) {
      this.#swatchEl.removeEventListener("click", this.#swatchClickHandler);
      this.#swatchClickHandler = null;
    }
    if (this.#outsideClickHandler) {
      document.removeEventListener("click", this.#outsideClickHandler);
      this.#outsideClickHandler = null;
    }
    this.#picker?.destroy?.();
    this.#picker = null;
    this.#pickerPortal?.remove();
    this.#pickerPortal = null;
    this.#bridge.destroy();
  }

  #setMode(
    mode: Mode
  ): void {
    this._mode = mode;
    this.#bridge.setMode(mode);
  }

  #onBrushSizeChange(
    event: Event
  ): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!Number.isNaN(value) && value > 0) {
      this._brushSize = value;
      this.#bridge.setBrushSize(value);
    }
  }

  readonly #onColorPicked = (
    event: Event
  ): void => {
    const { hex, opacity } = (
      event as CustomEvent<{ hex: string; opacity: number; }>
    ).detail;
    if (!this.#picker) {
      return;
    }

    const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, "0");
    this.#picker.setColor(`${hex}${alphaHex}`, true);
    const swatchEl = this.#swatchEl;
    if (swatchEl) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      swatchEl.style.background = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
  };

  #onTilesetChange(
    event: EventSelect
  ): void {
    this.tilesetId = event.target.value;
    if (this.vr) {
      this.#bridge.loadTileset(this.vr, this.tilesetId);
    }
  }

  #onExport(): void {
    const id = this.tilesetId || this.vr?.tilesetManager.defaultTilesetId || "texture";
    this.#bridge.exportPng(`${id}.png`);
  }

  override render() {
    const tilesetDefs = this.vr?.tilesetManager.getDefinitions() ?? [];
    const currentTilesetId = this.tilesetId || this.vr?.tilesetManager.defaultTilesetId || "";

    return html`
      <div class="toolbar">
        <button
          class=${this._mode === "paint" ? "active" : ""}
          @click=${() => this.#setMode("paint")}
          title="Paint mode"
        >Paint</button>
        <button
          class=${this._mode === "move" ? "active" : ""}
          @click=${() => this.#setMode("move")}
          title="Pan mode"
        >Pan</button>

        <label>
          Size
          <input
            type="number"
            min="1"
            max="32"
            .value=${String(this._brushSize)}
            @change=${this.#onBrushSizeChange}
          />
        </label>

        <button class="color-swatch" title="Brush color"></button>

        ${tilesetDefs.length > 1 ? html`
          <select @change=${this.#onTilesetChange}>
            ${tilesetDefs.map((def) => html`
              <option
                value=${def.id}
                ?selected=${currentTilesetId === def.id}
              >${def.id}</option>
            `)}
          </select>
        ` : null}

        <button @click=${this.#onExport}>Export</button>
      </div>

      <div class="canvas-host"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "texture-editor": TextureEditor;
  }
}
