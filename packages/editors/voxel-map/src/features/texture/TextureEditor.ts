// Import Third-party Dependencies
import {
  LitElement,
  html,
  css,
  type PropertyValues
} from "lit";
import { customElement, property } from "lit/decorators.js";
import type { PixelArtCanvasOptions } from "@jolly-pixel/pixel-draw.renderer";
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";
import {
  PixelDrawPanel,
  type TextureChangeDetail,
  type UvAccess
} from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import {
  editorState,
  type BrushStore,
  type TilesetStore,
  type WorldStore
} from "../../app/state/index.ts";
import type { TilesetEntry } from "../tilesets/tilesetEntries.ts";
import { blockTilesetStatus } from "../tilesets/blockTilesets.ts";
import {
  TilesetTab,
  type TextureRoom
} from "./TilesetTab.ts";

// CONSTANTS
const kCanvasHoverChangeEvent = "canvas-hover-change";
const kCanvasOptions: PixelArtCanvasOptions = {
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
};

export type TextureRoomFactory = (assetId: string) => TextureRoom;

@customElement("texture-editor")
export class TextureEditor extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
    }

    pixel-draw-panel {
      flex: 1;
      min-width: 0;
      min-height: 350px;
    }

    .empty {
      margin: 0;
      padding: var(--jolly-space-3, 12px);
      color: var(--jolly-text-muted);
      font-size: var(--jolly-font-size-sm, 12px);
    }
  `;

  @property({ attribute: false })
  declare engine: VoxelEngine | undefined;

  @property({ attribute: false })
  declare rooms: TextureRoomFactory | undefined;

  @property({ type: Boolean })
  declare active: boolean;

  @property({ type: String })
  declare uvAccess: UvAccess;

  @property({ attribute: false })
  declare brush: BrushStore;

  @property({ attribute: false })
  declare worldStore: WorldStore;

  @property({ attribute: false })
  declare tilesets: TilesetStore;

  #tabs = new Map<string, TilesetTab>();
  #panel: PixelDrawPanel | null = null;
  #reconciling: Promise<void> = Promise.resolve();
  #canvasHostEl: HTMLElement | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this.engine = undefined;
    this.rooms = undefined;
    this.active = false;
    this.uvAccess = "edit";
    this.brush = editorState.brush;
    this.worldStore = editorState.world;
    this.tilesets = editorState.tilesets;
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.#subscriptions.length > 0) {
      return;
    }

    this.#subscriptions.push(
      this.tilesets.watch("change", this.#requestSync),
      this.tilesets.watch("activeChange", this.#reconcile),
      this.brush.watch("blockChange", this.#onBlockChange),
      this.worldStore.watch("blockRegistryChanged", this.#requestSync)
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (!this.isConnected) {
        this.#teardown();
      }
    });
  }

  override updated(
    changed: PropertyValues<this>
  ) {
    if (changed.has("engine")) {
      this.#disposeTabs();
    }
    if (changed.has("active") && this.active) {
      this.#panel?.onResize();
    }
    this.#reconcile();
  }

  #tabEntries(): TilesetEntry[] {
    const { engine } = this;
    if (engine === undefined) {
      return [];
    }

    return this.tilesets.entries.filter((entry) => (
      entry.assetId !== null ||
      engine.tilesetManager.has(entry.definition.id)
    ));
  }

  readonly #reconcile = (): void => {
    this.#reconciling = this.#reconciling
      .then(() => this.#reconcileTabs())
      .catch((error: unknown) => {
        console.error("TextureEditor: failed to sync the tileset tabs", error);
      });
  };

  async #reconcileTabs(): Promise<void> {
    await this.updateComplete;
    const panel = this.renderRoot.querySelector("pixel-draw-panel");
    if (panel !== this.#panel) {
      this.#disposeTabs();
      await this.#adoptPanel(panel);
    }

    const { engine } = this;
    if (panel === null || panel !== this.#panel || engine === undefined) {
      return;
    }

    const entries = this.#tabEntries();
    for (const entry of entries) {
      const { definition, label, assetId } = entry;
      const tab = this.#tabs.get(definition.id);
      if (tab !== undefined) {
        panel.renameTexture(definition.id, label);
        tab.update(definition);
        continue;
      }

      const canvas = panel.addTexture(
        {
          id: definition.id,
          name: label
        },
        { activate: false }
      );
      this.#tabs.set(definition.id, new TilesetTab({
        canvas,
        engine,
        definition,
        room: assetId === null ? undefined : this.rooms?.(assetId),
        brush: this.brush,
        worldStore: this.worldStore
      }));
    }

    const kept = new Set(entries.map((entry) => entry.definition.id));
    for (const [tilesetId, tab] of this.#tabs) {
      if (!kept.has(tilesetId)) {
        panel.removeTexture(tilesetId);
        tab.dispose();
        this.#tabs.delete(tilesetId);
      }
    }

    const active = this.tilesets.activeTilesetId;
    if (active !== null && this.#tabs.has(active)) {
      panel.activeTextureId = active;
    }
  }

  async #adoptPanel(
    panel: PixelDrawPanel | null
  ): Promise<void> {
    this.#releasePanel();
    this.#panel = panel;
    if (panel === null) {
      return;
    }

    panel.addEventListener("texture-change", this.#onTextureChange);
    this.#resizeObserver = new ResizeObserver(() => panel.onResize());
    this.#resizeObserver.observe(panel);
    await panel.configure(kCanvasOptions);
    if (panel !== this.#panel) {
      return;
    }

    this.#canvasHostEl = panel.shadowRoot?.querySelector<HTMLElement>(
      "[part~='canvas-host']"
    ) ?? null;
    this.#canvasHostEl?.addEventListener("mouseenter", this.#onCanvasHoverEnter);
    this.#canvasHostEl?.addEventListener("mouseleave", this.#onCanvasHoverLeave);
  }

  #releasePanel(): void {
    this.#panel?.removeEventListener("texture-change", this.#onTextureChange);
    this.#canvasHostEl?.removeEventListener("mouseenter", this.#onCanvasHoverEnter);
    this.#canvasHostEl?.removeEventListener("mouseleave", this.#onCanvasHoverLeave);
    this.#canvasHostEl = null;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#panel = null;
  }

  #disposeTabs(): void {
    for (const tab of this.#tabs.values()) {
      tab.dispose();
    }
    this.#tabs.clear();
  }

  #teardown(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
    this.#disposeTabs();
    this.#releasePanel();
  }

  readonly #requestSync = (): void => {
    this.requestUpdate();
  };

  readonly #onBlockChange = (blockId: number): void => {
    const block = this.engine?.blockRegistry.get(blockId);
    if (block === undefined) {
      return;
    }

    const status = blockTilesetStatus(block, this.tilesets.ids());
    if (status.kind === "assigned") {
      this.tilesets.activeTilesetId = status.tilesetId;
    }
    else if (status.kind === "mixed") {
      this.tilesets.activeTilesetId = status.tilesetIds[0];
    }
  };

  readonly #onTextureChange = (
    event: CustomEvent<TextureChangeDetail>
  ): void => {
    if (event.detail.source === "user") {
      this.tilesets.activeTilesetId = event.detail.id;
    }
  };

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

  override render() {
    if (this.#tabEntries().length === 0) {
      return html`
        <p class="empty">
          No tileset to paint. Add one from the Tilesets folder.
        </p>
      `;
    }

    return html`
      <pixel-draw-panel
        .uvAccess=${this.uvAccess}
        .texturesClosable=${false}
      ></pixel-draw-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "texture-editor": TextureEditor;
  }
}
