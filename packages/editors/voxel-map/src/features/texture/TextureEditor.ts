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
import type { BlockRegistryChange } from "../../document/MapDocument.ts";
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import type { AddBlocksetDialog } from "../blocksets/dialogs/AddBlocksetDialog.ts";
import type { BlocksetEditDialog } from "../blocksets/dialogs/BlocksetEditDialog.ts";
import { BlocksetTab } from "./BlocksetTab.ts";
import {
  blockCountsByBlockset,
  blocksetTabLabels,
  type BlocksetTabLabels
} from "./blocksetTabLabels.ts";
import "../blocksets/dialogs/AddBlocksetDialog.ts";
import "../blocksets/dialogs/BlocksetEditDialog.ts";

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

  @query("add-blockset-dialog")
  private declare _addDialog: AddBlocksetDialog;

  @query("blockset-edit-dialog")
  private declare _editDialog: BlocksetEditDialog;

  #tabs = new Map<string, BlocksetTab>();
  #placeholders = new Set<string>();
  #panel: PixelDrawPanel | null = null;
  #releaseKeyBindings: (() => void) | null = null;
  #reconciling: Promise<void> = Promise.resolve();
  #followedBlocksetId: string | null = null;
  #adding = false;

  constructor() {
    super();
    this.active = false;
    this.uvAccess = "edit";
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { blocksets, mapDocument } = workspace;

    return [
      blocksets.subscribe("change", this.#requestSync),
      blocksets.subscribe("activeChange", this.#reconcile),
      workspace.state.block.subscribe("change", this.#onBlockChange),
      workspace.access.subscribe("change", this.#requestSync),
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
        console.error("TextureEditor: failed to sync the blockset tabs", error);
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

    const { view, blocksets } = workspace;
    const { entries } = blocksets;
    const counts = blockCountsByBlockset(workspace.mapDocument.blocks.getAll());
    for (const entry of entries) {
      const blocksetId = entry.id;
      const labels = blocksetTabLabels(entry, counts.get(blocksetId) ?? 0);
      const binding = blocksets.open(blocksetId);
      const tab = this.#tabs.get(blocksetId);
      const placeholder = tab === undefined && binding === undefined &&
        this.#placeholders.has(blocksetId);
      if ((tab !== undefined && tab.binding === binding) || placeholder) {
        panel.updateTexture(blocksetId, labels);
        continue;
      }

      this.#removeTab(panel, blocksetId);
      if (binding === undefined) {
        this.#showPlaceholder(panel, blocksetId, labels);
        continue;
      }

      const canvas = panel.addTexture(
        {
          id: blocksetId,
          ...labels,
          document: binding.opened.pixels
        },
        { activate: false }
      );
      this.#tabs.set(blocksetId, new BlocksetTab({
        panel,
        canvas,
        view,
        binding,
        blocks: blocksets,
        block: workspace.state.block,
        mapDocument: workspace.mapDocument
      }));
    }

    const kept = new Set(entries.map((entry) => entry.id));
    for (const blocksetId of [...this.#tabs.keys(), ...this.#placeholders]) {
      if (!kept.has(blocksetId)) {
        this.#removeTab(panel, blocksetId);
      }
    }

    const active = blocksets.activeBlocksetId;
    if (active !== null && this.#tabs.has(active)) {
      panel.activeTextureId = active;
    }
  }

  #removeTab(
    panel: PixelDrawPanel,
    blocksetId: string
  ): void {
    const tab = this.#tabs.get(blocksetId);
    if (tab !== undefined || this.#placeholders.has(blocksetId)) {
      panel.removeTexture(blocksetId);
    }
    tab?.dispose();
    this.#tabs.delete(blocksetId);
    this.#placeholders.delete(blocksetId);
  }

  #showPlaceholder(
    panel: PixelDrawPanel,
    blocksetId: string,
    labels: BlocksetTabLabels
  ): void {
    panel.addTexture({
      id: blocksetId,
      ...labels,
      disabled: true
    });
    this.#placeholders.add(blocksetId);
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
    panel.addEventListener("texture-create-request", this.#addBlockset);
    panel.addEventListener("texture-edit-request", this.#onEditRequest);
    this.#releaseKeyBindings =
      this.workspace?.state.pixelArtKeyBindings.bind(panel) ?? null;
    await panel.configure(kCanvasOptions);
  }

  #releasePanel(): void {
    const panel = this.#panel;
    panel?.removeEventListener("texture-change", this.#onTextureChange);
    panel?.removeEventListener("texture-create-request", this.#addBlockset);
    panel?.removeEventListener("texture-edit-request", this.#onEditRequest);
    this.#releaseKeyBindings?.();
    this.#releaseKeyBindings = null;
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

  readonly #onBlockRegistryChanged = (
    change: BlockRegistryChange
  ): void => {
    if (change === "retiled") {
      return;
    }

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

    const block = workspace.mapDocument.blocks.get(
      workspace.state.block.id
    );
    if (block === undefined) {
      return;
    }

    const blocksetId = workspace.blocksets.ownerOf(block.id)?.definition.id ?? null;
    if (!force && blocksetId === this.#followedBlocksetId) {
      return;
    }

    this.#followedBlocksetId = blocksetId;
    if (blocksetId !== null) {
      workspace.blocksets.activeBlocksetId = blocksetId;
    }
  }

  readonly #onTextureChange = (
    event: CustomEvent<TextureChangeDetail>
  ): void => {
    if (event.detail.source === "user" && this.workspace !== null) {
      this.workspace.blocksets.activeBlocksetId = event.detail.id;
    }
  };

  readonly #addBlockset = async(): Promise<void> => {
    const workspace = this.workspace;
    if (workspace === null || this.#adding) {
      return;
    }

    const { blocksets } = workspace;
    const active = blocksets.activeBlocksetId;
    const result = await this._addDialog.open({
      defaultTileSize: (active === null ? undefined : blocksets.tileSizeOf(active)) ??
        DEFAULT_TILE_SIZE,
      linkable: blocksets.linkableAssets()
    });
    if (result === null) {
      return;
    }

    this.#adding = true;
    try {
      const blocksetId = result.kind === "link" ?
        blocksets.link(result.assetId) :
        await blocksets.create(result);
      if (blocksetId === null) {
        workspace.state.log.push("Could not add the blockset: it was refused by the map.");
      }
      else {
        blocksets.activeBlocksetId = blocksetId;
      }
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      workspace.state.log.push(`Could not add the blockset: ${reason}`);
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

    const addable = workspace.access.current.has("blocksets");

    return html`
      ${workspace.blocksets.entries.length === 0 ?
        this.#renderEmpty(addable) :
        html`
          <pixel-draw-panel
            texture-tabs="always"
            texture-add-label="Add blockset"
            textures-editable
            normal-map
            .uvAccess=${this.uvAccess}
            .texturesAddable=${addable}
            .texturesClosable=${false}
          ></pixel-draw-panel>
        `}
      <add-blockset-dialog></add-blockset-dialog>
      <blockset-edit-dialog .workspace=${workspace}></blockset-edit-dialog>
    `;
  }

  #renderEmpty(
    addable: boolean
  ) {
    return html`
      <div class="empty">
        <p>No blockset yet.</p>
        <jolly-button
          icon="plus"
          ?disabled=${!addable}
          @click=${this.#addBlockset}
        >Add blockset</jolly-button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "texture-editor": TextureEditor;
  }
}
