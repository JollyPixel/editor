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
import type { JollyChangeDetail, JollyOption } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { TextureEditorBridge } from "./TextureEditorBridge.ts";
import { BlockUvBridge } from "./BlockUvBridge.ts";

// CONSTANTS
const kCanvasHoverChangeEvent = "canvas-hover-change";

@customElement("texture-editor")
export class TextureEditor extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
    }

    jolly-toolbar {
      flex-shrink: 0;
      flex-wrap: wrap;
      padding: var(--jolly-space-1, 4px);
      border-bottom: 1px solid var(--jolly-groove);
    }

    pixel-draw-panel {
      flex: 1;
      min-width: 0;
      min-height: 350px;
    }
  `;

  @property({ attribute: false })
  declare vr: VoxelRenderer | undefined;
  @property({ attribute: false })
  declare room: network.Room<PixelNetworkCommand, PixelServerMessage> | undefined;
  @property({ type: String })
  declare tilesetId: string;
  @property({ type: Boolean })
  declare active: boolean;

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
      }
      // Buffer events drive once-per-frame tileset sync.
    });
    if (!this.isConnected) {
      return;
    }
    this.#canvas = canvas;
    this.#bridge.attach(canvas, this.room);

    if (this.vr) {
      this.#uvBridge = new BlockUvBridge(canvas.uv, this.vr);
      this.#applyTileset(this.tilesetId || null);
    }

    this.#canvasHostEl = panelEl.shadowRoot!.querySelector<HTMLDivElement>(".canvas-host");
    this.#canvasHostEl?.addEventListener(
      "mouseenter",
      this.#onCanvasHoverEnter
    );
    this.#canvasHostEl?.addEventListener(
      "mouseleave",
      this.#onCanvasHoverLeave
    );

    this.#resizeObserver = new ResizeObserver(() => panelEl.onResize());
    this.#resizeObserver.observe(panelEl);
  }

  override updated(
    changed: Map<string, unknown>
  ) {
    if (!this.#bridge.isActive) {
      return;
    }

    if (changed.has("room") && this.#canvas) {
      this.#bridge.attach(this.#canvas, this.room);
    }

    if (changed.has("active") && this.active) {
      this.#panelEl?.onResize();
    }

    if (
      (changed.has("vr") || changed.has("tilesetId")) &&
      this.vr
    ) {
      if (changed.has("vr")) {
        this.#uvBridge?.dispose();
        this.#uvBridge = null;
      }
      if (!this.#uvBridge && this.#canvas) {
        this.#uvBridge = new BlockUvBridge(this.#canvas.uv, this.vr);
      }
      this.#applyTileset(this.tilesetId || null);
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#canvasHostEl?.removeEventListener(
      "mouseenter",
      this.#onCanvasHoverEnter
    );
    this.#canvasHostEl?.removeEventListener(
      "mouseleave",
      this.#onCanvasHoverLeave
    );
    this.#canvasHostEl = null;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#uvBridge?.dispose();
    this.#uvBridge = null;
    this.#bridge.destroy();
    this.#panelEl = null;
  }

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
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this.tilesetId = event.detail.value;
    this.#applyTileset(this.tilesetId);
  }

  override render() {
    const tilesetDefs = this.vr?.engine.tilesetManager.getDefinitions() ?? [];
    const currentTilesetId = this.tilesetId || this.vr?.engine.tilesetManager.defaultTilesetId || "";
    const tilesetOptions: JollyOption<string>[] = tilesetDefs.map((def) => {
      return { label: def.id, value: def.id };
    });

    return html`
      ${tilesetDefs.length > 1 ? html`
        <jolly-toolbar label="Tileset">
          <jolly-select
            .options=${tilesetOptions}
            .value=${currentTilesetId}
            @jolly-change=${this.#onTilesetChange}
          ></jolly-select>
        </jolly-toolbar>
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
