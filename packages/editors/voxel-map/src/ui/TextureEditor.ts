// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import type * as network from "@jolly-pixel/network";
import type {
  PixelArtCanvas,
  PixelNetworkCommand,
  PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";
import { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import { TextureEditorBridge } from "../lib/TextureEditorBridge.ts";
import { BlockUvBridge } from "../lib/BlockUvBridge.ts";
import type { EventSelect } from "./types.ts";

// CONSTANTS
const kCanvasHoverChangeEvent = "canvas-hover-change";

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

    .toolbar select {
      background: #111a20;
      border: 1px solid #333;
      color: #eee;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 11px;
      max-width: 100px;
    }

    /*
     * Deliberately no "display" override here: an outer-tree rule targeting
     * a custom element wins over that element's own ":host { display }"
     * regardless of specificity, and pixel-draw-panel's internal rail/stage
     * layout depends on its own ":host { display: flex }" staying intact.
     */
    pixel-draw-panel {
      flex: 1;
      min-width: 0;
      min-height: 350px;
    }
  `;

  @property({ attribute: false }) declare vr: VoxelRenderer | undefined;
  @property({ attribute: false }) declare room: network.Room<PixelNetworkCommand, PixelServerMessage> | undefined;
  @property({ type: String }) declare tilesetId: string;
  @property({ type: Boolean }) declare active: boolean;

  readonly #bridge = new TextureEditorBridge();
  #uvBridge: BlockUvBridge | null = null;
  #canvas: PixelArtCanvas | null = null;
  #panelEl: PixelDrawPanel | null = null;
  #canvasHostEl: HTMLDivElement | null = null;
  #resizeObserver: ResizeObserver | null = null;

  constructor() {
    super();
    this.tilesetId = "";
    this.active = false;
  }

  override async firstUpdated() {
    const panelEl = this.shadowRoot!.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
    this.#panelEl = panelEl;

    const canvas = await panelEl.initialize({
      zoom: {
        default: 1,
        min: 1,
        max: 32,
        sensitivity: 0.6
      },
      brush: {
        size: 1,
        color: "#000000"
      },
      texture: {
        maxSize: 2048
      },
      onDrawEnd: () => this.#bridge.syncToThree()
    });
    this.#canvas = canvas;
    this.#bridge.attach(canvas, this.room);

    if (this.vr) {
      this.#uvBridge = new BlockUvBridge(canvas.uv, this.vr);
      this.#applyTileset(this.tilesetId || null);
    }

    this.#canvasHostEl = panelEl.shadowRoot!.querySelector<HTMLDivElement>(".canvas-host");
    this.#canvasHostEl?.addEventListener("mouseenter", this.#onCanvasHoverEnter);
    this.#canvasHostEl?.addEventListener("mouseleave", this.#onCanvasHoverLeave);

    this.#resizeObserver = new ResizeObserver(() => panelEl.onResize());
    this.#resizeObserver.observe(panelEl);
  }

  override updated(
    changed: Map<string, unknown>
  ) {
    if (!this.#bridge.isActive) {
      return;
    }

    if (changed.has("active") && this.active) {
      this.#panelEl?.onResize();
    }

    if ((changed.has("vr") || changed.has("tilesetId")) && this.vr) {
      if (!this.#uvBridge && this.#canvas) {
        this.#uvBridge = new BlockUvBridge(this.#canvas.uv, this.vr);
      }
      this.#applyTileset(this.tilesetId || null);
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#canvasHostEl?.removeEventListener("mouseenter", this.#onCanvasHoverEnter);
    this.#canvasHostEl?.removeEventListener("mouseleave", this.#onCanvasHoverLeave);
    this.#canvasHostEl = null;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#uvBridge?.dispose();
    this.#uvBridge = null;
    this.#bridge.destroy();
    this.#panelEl = null;
  }

  /**
   * Loads the given tileset (or the engine's default) into both the
   * texture-sync bridge and the block-driven UV region set.
   */
  #applyTileset(
    tilesetId: string | null
  ): void {
    if (!this.vr) {
      return;
    }

    this.#bridge.loadTileset(this.vr, tilesetId);

    const resolvedId = tilesetId ?? this.vr.engine.tilesetManager.defaultTilesetId;
    const def = resolvedId
      ? this.vr.engine.tilesetManager.getDefinitions().find((candidate) => candidate.id === resolvedId)
      : undefined;
    if (def) {
      this.#uvBridge?.setActiveTileset(def.id, def.tileSize);
    }
  }

  /**
   * Reports pointer hover over the drawing canvas so the host app can yield
   * its own keyboard shortcuts (e.g. a 3D viewport's WASD camera) while the
   * user is interacting with this canvas instead. `composed: true` lets it
   * cross this component's shadow DOM boundary.
   */
  #dispatchHoverChange(
    hovering: boolean
  ): void {
    this.dispatchEvent(new CustomEvent(kCanvasHoverChangeEvent, {
      detail: { hovering },
      bubbles: true,
      composed: true
    }));
  }

  readonly #onCanvasHoverEnter = (): void => {
    this.#dispatchHoverChange(true);
  };

  readonly #onCanvasHoverLeave = (): void => {
    this.#dispatchHoverChange(false);
  };

  #onTilesetChange(
    event: EventSelect
  ): void {
    this.tilesetId = event.target.value;
    this.#applyTileset(this.tilesetId);
  }

  override render() {
    const tilesetDefs = this.vr?.engine.tilesetManager.getDefinitions() ?? [];
    const currentTilesetId = this.tilesetId || this.vr?.engine.tilesetManager.defaultTilesetId || "";

    return html`
      ${tilesetDefs.length > 1 ? html`
        <div class="toolbar">
          <select @change=${this.#onTilesetChange}>
            ${tilesetDefs.map((def) => html`
              <option
                value=${def.id}
                ?selected=${currentTilesetId === def.id}
              >${def.id}</option>
            `)}
          </select>
        </div>
      ` : null}

      <pixel-draw-panel></pixel-draw-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "texture-editor": TextureEditor;
  }
}
