// Import Third-party Dependencies
import {
  html,
  css,
  nothing,
  type PropertyValues
} from "lit";
import {
  customElement,
  property,
  query
} from "lit/decorators.js";
import type { PixelArtCanvasOptions } from "@jolly-pixel/pixel-draw.renderer";
import { DEFAULT_TILE_SIZE } from "@jolly-pixel/voxel.renderer";
import {
  PixelDrawPanel,
  type TextureChangeDetail,
  type TextureEditRequestDetail,
  type UvAccess
} from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import { countBlocksPerTileset } from "../tilesets/blockTilesets.ts";
import type { AddTilesetDialog } from "../tilesets/AddTilesetDialog.ts";
import type { TilesetEditDialog } from "../tilesets/TilesetEditDialog.ts";
import { TilesetTab } from "./TilesetTab.ts";
import {
  tilesetTabLabels,
  type TilesetTabLabels
} from "./tilesetTabLabels.ts";
import "../tilesets/AddTilesetDialog.ts";
import "../tilesets/TilesetEditDialog.ts";

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
export class TextureEditor extends WorkspaceElement {
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

  @property({ type: Boolean })
  declare active: boolean;

  @property({ type: String })
  declare uvAccess: UvAccess;

  @query("add-tileset-dialog")
  private declare _addDialog: AddTilesetDialog;

  @query("tileset-edit-dialog")
  private declare _editDialog: TilesetEditDialog;

  #tabs = new Map<string, TilesetTab>();
  #placeholders = new Set<string>();
  #panel: PixelDrawPanel | null = null;
  #reconciling: Promise<void> = Promise.resolve();
  #followedTilesetId: string | null = null;
  #adding = false;

  constructor() {
    super();
    this.active = false;
    this.uvAccess = "edit";
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { tilesets, mapDocument } = workspace;

    return [
      tilesets.subscribe("change", this.#requestSync),
      tilesets.subscribe("activeChange", this.#reconcile),
      workspace.state.brush.subscribe("blockChange", this.#onBlockChange),
      mapDocument.subscribe("blockRegistryChanged", this.#onBlockRegistryChanged)
    ];
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (!this.isConnected) {
        this.#disposeTabs();
        this.#releasePanel();
      }
    });
  }

  override updated(
    changed: PropertyValues<this>
  ) {
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

    const workspace = this.workspace;
    if (workspace === null || panel === null || panel !== this.#panel) {
      return;
    }

    const { engine, tilesets } = workspace;
    const { entries } = tilesets;
    const counts = countBlocksPerTileset(engine.document.blocks.getAll());
    for (const entry of entries) {
      const tilesetId = entry.definition.id;
      const labels = tilesetTabLabels(entry, counts.get(tilesetId) ?? 0);
      const binding = tilesets.open(tilesetId);
      const tab = this.#tabs.get(tilesetId);
      const placeholder = tab === undefined && binding === undefined &&
        this.#placeholders.has(tilesetId);
      if ((tab !== undefined && tab.binding === binding) || placeholder) {
        panel.updateTexture(tilesetId, labels);
        continue;
      }

      this.#removeTab(panel, tilesetId);
      if (binding === undefined) {
        this.#showPlaceholder(panel, tilesetId, labels);
        continue;
      }

      const canvas = panel.addTexture(
        {
          id: tilesetId,
          ...labels,
          document: binding.opened.pixels
        },
        { activate: false }
      );
      this.#tabs.set(tilesetId, new TilesetTab({
        canvas,
        engine,
        binding,
        blocks: tilesets,
        brush: workspace.state.brush,
        mapDocument: workspace.mapDocument
      }));
    }

    const kept = new Set(entries.map((entry) => entry.definition.id));
    for (const tilesetId of [...this.#tabs.keys(), ...this.#placeholders]) {
      if (!kept.has(tilesetId)) {
        this.#removeTab(panel, tilesetId);
      }
    }

    const active = tilesets.activeTilesetId;
    if (active !== null && this.#tabs.has(active)) {
      panel.activeTextureId = active;
    }
  }

  #removeTab(
    panel: PixelDrawPanel,
    tilesetId: string
  ): void {
    const tab = this.#tabs.get(tilesetId);
    if (tab !== undefined || this.#placeholders.has(tilesetId)) {
      panel.removeTexture(tilesetId);
    }
    tab?.dispose();
    this.#tabs.delete(tilesetId);
    this.#placeholders.delete(tilesetId);
  }

  #showPlaceholder(
    panel: PixelDrawPanel,
    tilesetId: string,
    labels: TilesetTabLabels
  ): void {
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
    const workspace = this.workspace;
    if (workspace === null) {
      return;
    }

    const block = workspace.engine.document.blocks.get(
      workspace.state.brush.blockId
    );
    if (block === undefined) {
      return;
    }

    const tilesetId = workspace.tilesets.ownerOf(block.id)?.definition.id ?? null;
    if (!force && tilesetId === this.#followedTilesetId) {
      return;
    }

    this.#followedTilesetId = tilesetId;
    if (tilesetId !== null) {
      workspace.tilesets.activeTilesetId = tilesetId;
    }
  }

  readonly #onTextureChange = (
    event: CustomEvent<TextureChangeDetail>
  ): void => {
    if (event.detail.source === "user" && this.workspace !== null) {
      this.workspace.tilesets.activeTilesetId = event.detail.id;
    }
  };

  readonly #addTileset = async(): Promise<void> => {
    const workspace = this.workspace;
    if (workspace === null || this.#adding) {
      return;
    }

    const { tilesets } = workspace;
    const active = tilesets.activeTilesetId;
    const result = await this._addDialog.open({
      defaultTileSize: (active === null ? undefined : tilesets.tileSizeOf(active)) ??
        DEFAULT_TILE_SIZE,
      linkable: tilesets.linkableAssets()
    });
    if (result === null) {
      return;
    }

    this.#adding = true;
    try {
      const tilesetId = result.kind === "link" ?
        tilesets.link(result.assetId) :
        await tilesets.create(result);
      if (tilesetId === null) {
        workspace.state.log.push("Could not add the tileset: it was refused by the map.");
      }
      else {
        tilesets.activeTilesetId = tilesetId;
      }
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      workspace.state.log.push(`Could not add the tileset: ${reason}`);
    }
    finally {
      this.#adding = false;
    }
  };

  readonly #onEditRequest = (
    event: CustomEvent<TextureEditRequestDetail>
  ): void => {
    void this._editDialog.open(event.detail.id);
  };

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    return html`
      ${workspace.tilesets.entries.length === 0 ?
        this.#renderEmpty() :
        html`
          <pixel-draw-panel
            texture-tabs="always"
            texture-add-label="Add tileset"
            textures-editable
            .uvAccess=${this.uvAccess}
            .texturesAddable=${true}
            .texturesClosable=${false}
          ></pixel-draw-panel>
        `}
      <add-tileset-dialog></add-tileset-dialog>
      <tileset-edit-dialog .workspace=${workspace}></tileset-edit-dialog>
    `;
  }

  #renderEmpty() {
    return html`
      <div class="empty">
        <p>No tileset yet.</p>
        <jolly-button
          icon="plus"
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
