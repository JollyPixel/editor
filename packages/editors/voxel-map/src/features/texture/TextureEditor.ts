// Import Third-party Dependencies
import {
  LitElement,
  html,
  css,
  type PropertyValues
} from "lit";
import {
  customElement,
  property,
  query
} from "lit/decorators.js";
import type { PixelArtCanvasOptions } from "@jolly-pixel/pixel-draw.renderer";
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";
import {
  PixelDrawPanel,
  type TextureChangeDetail,
  type TextureEditRequestDetail,
  type UvAccess
} from "@jolly-pixel/editor.pixel-art";
import type { LogQueue } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { MapDocument } from "../../document/index.ts";
import type {
  BlockUsageStore,
  BrushStore,
  TilesetStore
} from "../../state/index.ts";
import { countBlocksPerTileset } from "../tilesets/blockTilesets.ts";
import type { LinkedTilesets } from "../tilesets/LinkedTilesets.ts";
import type { TilesetActions } from "../tilesets/TilesetActions.ts";
import type { TilesetDialogs } from "../tilesets/TilesetDialogs.ts";
import { TilesetTab } from "./TilesetTab.ts";
import {
  tilesetTabLabels,
  type TilesetTabLabels
} from "./tilesetTabLabels.ts";
import "../tilesets/TilesetDialogs.ts";

// CONSTANTS
const kCanvasOptions: PixelArtCanvasOptions = {
  zoom: {
    default: 1,
    min: 1,
    max: 32
  },
  brush: {
    size: 1,
    color: "#000000"
  },
  uv: {
    deselectOnEmptyClick: false
  }
};

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
      display: flex;
      align-items: center;
      gap: var(--jolly-space-2, 8px);
      padding: var(--jolly-space-3, 12px);
      color: var(--jolly-text-muted);
      font-size: var(--jolly-font-size-sm, 12px);
    }

    .empty p {
      margin: 0;
    }
  `;

  @property({ attribute: false })
  declare engine: VoxelEngine;

  @property({ attribute: false })
  declare linked: LinkedTilesets;

  @property({ type: Boolean })
  declare active: boolean;

  @property({ type: String })
  declare uvAccess: UvAccess;

  @property({ attribute: false })
  declare brush: BrushStore;

  @property({ attribute: false })
  declare mapDocument: MapDocument;

  @property({ attribute: false })
  declare tilesets: TilesetStore;

  @property({ attribute: false })
  declare actions: TilesetActions | null;

  @property({ attribute: false })
  declare usage: BlockUsageStore;

  @property({ attribute: false })
  declare log: LogQueue;

  @query("tileset-dialogs")
  private declare _dialogs: TilesetDialogs;

  #tabs = new Map<string, TilesetTab>();
  #placeholders = new Set<string>();
  #panel: PixelDrawPanel | null = null;
  #reconciling: Promise<void> = Promise.resolve();
  #subscriptions: Array<() => void> = [];
  #followedTilesetId: string | null = null;

  constructor() {
    super();
    this.active = false;
    this.uvAccess = "edit";
    this.actions = null;
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.#subscriptions.length > 0) {
      return;
    }

    this.#subscriptions.push(
      this.tilesets.subscribe("change", this.#requestSync),
      this.tilesets.subscribe("activeChange", this.#reconcile),
      this.linked.subscribe("change", this.#requestSync),
      this.brush.subscribe("blockChange", this.#onBlockChange),
      this.mapDocument.subscribe(
        "blockRegistryChanged",
        this.#onBlockRegistryChanged
      )
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
    if (changed.has("engine") || changed.has("linked")) {
      this.#disposeTabs();
    }
    if (changed.has("active") && this.active) {
      this.#panel?.onResize();
    }
    this.#reconcile();
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

    const { engine, linked } = this;
    if (panel === null || panel !== this.#panel) {
      return;
    }

    const { entries } = this.tilesets;
    const counts = countBlocksPerTileset(engine.blockRegistry.getAll());
    for (const entry of entries) {
      const { definition, assetId } = entry;
      const blocks = counts.get(definition.id) ?? 0;
      const tab = this.#tabs.get(definition.id);
      if (tab !== undefined) {
        panel.updateTexture(definition.id, tilesetTabLabels(entry, {
          blocks,
          detached: tab.assetId !== null && assetId !== tab.assetId
        }));
        tab.update(definition);
        continue;
      }

      const labels = tilesetTabLabels(entry, { blocks });
      const opened = linked.open(definition.id);
      if (opened === undefined) {
        this.#showPlaceholder(panel, definition.id, labels);
        continue;
      }

      if (this.#placeholders.delete(definition.id)) {
        panel.removeTexture(definition.id);
      }
      const canvas = panel.addTexture(
        {
          id: definition.id,
          ...labels,
          document: opened.opened.pixels
        },
        { activate: false }
      );
      this.#tabs.set(definition.id, new TilesetTab({
        canvas,
        engine,
        linked: opened,
        assetId,
        blocks: linked,
        brush: this.brush,
        mapDocument: this.mapDocument
      }));
    }

    const kept = new Set(entries.map((entry) => entry.definition.id));
    for (const [tilesetId, tab] of this.#tabs) {
      if (!kept.has(tilesetId) || !linked.has(tilesetId)) {
        panel.removeTexture(tilesetId);
        tab.dispose();
        this.#tabs.delete(tilesetId);
      }
    }
    for (const tilesetId of [...this.#placeholders]) {
      if (!kept.has(tilesetId)) {
        panel.removeTexture(tilesetId);
        this.#placeholders.delete(tilesetId);
      }
    }

    const active = this.tilesets.activeTilesetId;
    if (active !== null && this.#tabs.has(active)) {
      panel.activeTextureId = active;
    }
  }

  #showPlaceholder(
    panel: PixelDrawPanel,
    tilesetId: string,
    labels: TilesetTabLabels
  ): void {
    if (this.#placeholders.has(tilesetId)) {
      panel.updateTexture(tilesetId, labels);

      return;
    }

    panel.addTexture({
      id: tilesetId,
      ...labels,
      disabled: true
    });
    this.#placeholders.add(tilesetId);
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
    panel.addEventListener("texture-create-request", this.#addTileset);
    panel.addEventListener("texture-edit-request", this.#onEditRequest);
    await panel.configure(kCanvasOptions);
  }

  #releasePanel(): void {
    const panel = this.#panel;
    panel?.removeEventListener("texture-change", this.#onTextureChange);
    panel?.removeEventListener("texture-create-request", this.#addTileset);
    panel?.removeEventListener("texture-edit-request", this.#onEditRequest);
    this.#panel = null;
  }

  #disposeTabs(): void {
    for (const tab of this.#tabs.values()) {
      tab.dispose();
    }
    this.#tabs.clear();
    this.#placeholders.clear();
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

  readonly #onBlockChange = (): void => {
    this.#followSelectedBlock(true);
  };

  readonly #onBlockRegistryChanged = (): void => {
    this.#followSelectedBlock(false);
    this.requestUpdate();
  };

  #followSelectedBlock(
    force: boolean
  ): void {
    const block = this.engine.blockRegistry.get(this.brush.blockId);
    if (block === undefined) {
      return;
    }

    const tilesetId = this.linked.ownerOf(block.id)?.definition.id ?? null;
    if (!force && tilesetId === this.#followedTilesetId) {
      return;
    }

    this.#followedTilesetId = tilesetId;
    if (tilesetId !== null) {
      this.tilesets.activeTilesetId = tilesetId;
    }
  }

  readonly #onTextureChange = (
    event: CustomEvent<TextureChangeDetail>
  ): void => {
    if (event.detail.source === "user") {
      this.tilesets.activeTilesetId = event.detail.id;
    }
  };

  readonly #addTileset = (): void => {
    void this._dialogs.add();
  };

  readonly #onEditRequest = (
    event: CustomEvent<TextureEditRequestDetail>
  ): void => {
    void this._dialogs.edit(event.detail.id);
  };

  override render() {
    return html`
      ${this.tilesets.entries.length === 0 ?
        this.#renderEmpty() :
        html`
          <pixel-draw-panel
            texture-tabs="always"
            texture-add-label="Add tileset"
            textures-editable
            .uvAccess=${this.uvAccess}
            .texturesClosable=${false}
            .texturesAddable=${this.actions !== null}
          ></pixel-draw-panel>
        `}
      <tileset-dialogs
        .engine=${this.engine}
        .actions=${this.actions}
        .tilesets=${this.tilesets}
        .linked=${this.linked}
        .mapDocument=${this.mapDocument}
        .usage=${this.usage}
        .log=${this.log}
      ></tileset-dialogs>
    `;
  }

  #renderEmpty() {
    return html`
      <div class="empty">
        <p>No tileset yet.</p>
        <jolly-button
          icon="plus"
          ?disabled=${this.actions === null}
          @click=${this.#addTileset}
        >Add tileset</jolly-button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "texture-editor": TextureEditor;
  }
}
