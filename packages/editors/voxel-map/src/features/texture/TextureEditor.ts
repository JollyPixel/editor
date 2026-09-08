// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";
import type * as network from "@jolly-pixel/network";
import type {
  PixelArtCanvas,
  PixelNetworkCommand,
  PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";
import { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";
import type { JollyChangeDetail, JollyOption } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  editorState,
  type BrushStore,
  type WorldStore
} from "../../app/state/index.ts";
import { TextureEditorBridge } from "./bridge/TextureEditorBridge.ts";
import { BlockUvBridge } from "./bridge/BlockUvBridge.ts";

// CONSTANTS
const kCanvasHoverChangeEvent = "canvas-hover-change";

@customElement("texture-editor")
export class TextureEditor extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
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
  declare engine: VoxelEngine | undefined;
  @property({ attribute: false })
  declare room: network.Room<PixelNetworkCommand, PixelServerMessage> | undefined;
  @property({ type: String })
  declare tilesetId: string;
  @property({ type: Boolean })
  declare active: boolean;
  @property({ attribute: false })
  declare brush: BrushStore;
  @property({ attribute: false })
  declare worldStore: WorldStore;

  @query("pixel-draw-panel")
  declare private _panel: PixelDrawPanel;

  #bridge: TextureEditorBridge | null = null;
  #uvBridge: BlockUvBridge | null = null;
  #canvas: PixelArtCanvas | null = null;
  #panelEl: PixelDrawPanel | null = null;
  #canvasHostEl: HTMLDivElement | null = null;
  #resizeObserver: ResizeObserver | null = null;

  constructor() {
    super();
    this.engine = undefined;
    this.tilesetId = "";
    this.active = false;
    this.brush = editorState.brush;
    this.worldStore = editorState.world;
  }

  override async firstUpdated() {
    const bridge = new TextureEditorBridge({ worldStore: this.worldStore });
    this.#bridge = bridge;
    const panelEl = this._panel;
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
      uv: {
        deselectOnEmptyClick: false
      },
      history: {
        enabled: true
      }
    });
    if (!this.isConnected) {
      return;
    }
    this.#canvas = canvas;
    bridge.attach(canvas, this.room);

    if (this.engine) {
      this.#uvBridge = new BlockUvBridge(canvas.uv, this.engine, {
        runLocalRestore: (fn) => canvas.runLocalRestore(fn),
        brush: this.brush,
        worldStore: this.worldStore
      });
      this.#applyTileset(this.tilesetId || null);
    }

    this.#canvasHostEl = panelEl.shadowRoot?.querySelector<HTMLDivElement>(
      "[part~='canvas-host']"
    ) ?? null;
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
    const bridge = this.#bridge;
    if (!bridge?.isActive) {
      return;
    }

    if (changed.has("room") && this.#canvas) {
      bridge.attach(this.#canvas, this.room);
    }

    if (changed.has("active") && this.active) {
      this.#panelEl?.onResize();
    }

    if (
      (changed.has("engine") || changed.has("tilesetId")) &&
      this.engine
    ) {
      if (changed.has("engine")) {
        this.#uvBridge?.dispose();
        this.#uvBridge = null;
      }
      const canvas = this.#canvas;
      if (!this.#uvBridge && canvas) {
        this.#uvBridge = new BlockUvBridge(
          canvas.uv,
          this.engine,
          {
            runLocalRestore: (fn) => canvas.runLocalRestore(fn),
            brush: this.brush,
            worldStore: this.worldStore
          }
        );
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
    this.#bridge?.destroy();
    this.#bridge = null;
    this.#panelEl = null;
  }

  #applyTileset(
    tilesetId: string | null
  ): void {
    if (!this.engine) {
      return;
    }

    this.#bridge?.loadTileset(this.engine, tilesetId);

    const resolvedId = tilesetId ?? this.engine.tilesetManager.defaultTilesetId;
    const def = resolvedId
      ? this.engine.tilesetManager.definitions().find((candidate) => candidate.id === resolvedId)
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
    const tilesetDefs = this.engine?.tilesetManager.definitions() ?? [];
    const currentTilesetId = this.tilesetId ||
      this.engine?.tilesetManager.defaultTilesetId ||
      "";
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
