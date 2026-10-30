// Import Third-party Dependencies
import {
  html,
  css,
  nothing,
  type PropertyValues
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import type { PixelArtCanvasOptions } from "@jolly-pixel/pixel-draw.renderer";
import { DEFAULT_TILE_SIZE } from "@jolly-pixel/voxel.renderer";
import {
  BLOCKSET_EXTENSION,
  BLOCKSET_KIND
} from "@jolly-pixel/asset.voxel-map/client";
import {
  PixelDrawPanel,
  type TextureChangeDetail,
  type TextureEditRequestDetail,
  type TextureFileDrop,
  type UvAccess
} from "@jolly-pixel/editor.pixel-art";
import { LazyTemplate } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";

// Import Internal Dependencies
import type { BlockRegistryChange } from "../../map/EditorMap.ts";
import type { VoxelMapEditing } from "../../editing/VoxelMapEditing.ts";
import { EditingElement } from "../../editing/EditingElement.ts";
import { BlocksetTab } from "./BlocksetTab.ts";
import {
  blocksetTabLabels,
  type BlocksetTabLabels
} from "./blocksetTabLabels.ts";
import { describeError } from "../../shared/describeError.ts";

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
const kBlocksetDropTypes = [
  "application/zip",
  "application/x-zip-compressed",
  "application/json"
];
const kNoFileDrops: readonly TextureFileDrop[] = [];

@customElement("texture-editor")
export class TextureEditor extends EditingElement {
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

  #dialogs = new LazyTemplate(this, () => Promise.all([
    import("../blocksets/dialogs/AddBlocksetDialog.ts"),
    import("../blocksets/dialogs/BlocksetEditDialog.ts")
  ]));
  #tabs = new Map<string, BlocksetTab>();
  #placeholders = new Set<string>();
  #panel: PixelDrawPanel | null = null;
  #reconciling: Promise<void> = Promise.resolve();
  #followedBlocksetId: string | null = null;
  #adding = false;
  readonly #blocksetDrops: readonly TextureFileDrop[] = [
    {
      types: kBlocksetDropTypes,
      extensions: [".zip", BLOCKSET_EXTENSION],
      label: "Drop blockset to add",
      drop: (file) => {
        void this.#dropBlockset(file);
      }
    }
  ];

  constructor() {
    super();
    this.active = false;
    this.uvAccess = "edit";
  }

  protected override watchEditing(
    editing: VoxelMapEditing
  ): Iterable<() => void> {
    const { blocksets, editorMap } = editing;

    return [
      blocksets.subscribe("change", this.#requestSync),
      blocksets.subscribe("activeChange", this.#reconcile),
      editing.state.block.subscribe("change", this.#onBlockChange),
      editing.access.subscribe("change", this.#requestSync),
      editing.state.textureTabs.subscribe("change", this.#requestSync),
      editorMap.subscribe("blockRegistryChanged", this.#onBlockRegistryChanged)
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

    const editing = this.editing;
    if (editing === null || panel === null || panel !== this.#panel) {
      return;
    }

    const { view, blocksets } = editing;
    const { entries } = blocksets;
    for (const entry of entries) {
      const blocksetId = entry.id;
      const labels = blocksetTabLabels(entry);
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
        block: editing.state.block,
        uvSync: editing.state.uvSync,
        editorMap: editing.editorMap
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
    this.#followActiveCanvas();
  }

  #followActiveCanvas(): void {
    const canvas = this.#panel?.canvasManager ?? null;
    if (canvas !== null) {
      this.editing?.state.textureView.follow(canvas);
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
    if (this.editing) {
      panel.keyBindings = this.editing.state.pixelArtKeyBindings;
      panel.uvNets = this.editing.state.uvNets;
    }
    await panel.configure(kCanvasOptions);
  }

  #releasePanel(): void {
    const panel = this.#panel;
    panel?.removeEventListener("texture-change", this.#onTextureChange);
    panel?.removeEventListener("texture-create-request", this.#addBlockset);
    panel?.removeEventListener("texture-edit-request", this.#onEditRequest);
    this.editing?.state.textureView.dispose();
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
  };

  #followSelectedBlock(
    force: boolean
  ): void {
    const editing = this.editing;
    if (editing === null) {
      return;
    }

    const block = editing.state.block.resolve(editing.editorMap.blocks);
    if (block === undefined) {
      return;
    }

    const blocksetId = editing.blocksets.findOwner(block.id)?.definition.id ?? null;
    if (!force && blocksetId === this.#followedBlocksetId) {
      return;
    }

    this.#followedBlocksetId = blocksetId;
    if (blocksetId !== null) {
      editing.blocksets.activeBlocksetId = blocksetId;
    }
  }

  readonly #onTextureChange = (
    event: CustomEvent<TextureChangeDetail>
  ): void => {
    this.#followActiveCanvas();
    if (event.detail.source === "user" && this.editing !== null) {
      this.editing.blocksets.activeBlocksetId = event.detail.id;
    }
  };

  readonly #addBlockset = async(): Promise<void> => {
    const editing = this.editing;
    if (editing === null || this.#adding) {
      return;
    }

    const { blocksets } = editing;
    const active = blocksets.activeBlocksetId;
    const dialog = await this.#dialogs.query("add-blockset-dialog");
    const result = await dialog.open({
      defaultTileSize: (active === null ? undefined : blocksets.blocksetTileSize(active)) ??
        DEFAULT_TILE_SIZE,
      linkable: blocksets.linkableAssets(),
      importable: editing.archives.canImport
    });
    if (result === null) {
      return;
    }

    await this.#add(editing, async() => {
      switch (result.kind) {
        case "import":
          await editing.archives.pickAndImport(BLOCKSET_KIND);
          break;
        case "link":
          blocksets.link(result.assetId);
          break;
        case "create":
          await blocksets.create(result);
          break;
      }
    });
  };

  async #dropBlockset(
    file: File
  ): Promise<void> {
    const editing = this.editing;
    if (editing === null || this.#adding) {
      return;
    }

    await this.#add(
      editing,
      () => editing.archives.importFile(file, BLOCKSET_KIND)
    );
  }

  async #add(
    editing: VoxelMapEditing,
    run: () => Promise<void>
  ): Promise<void> {
    this.#adding = true;
    try {
      await run();
    }
    catch (error) {
      editing.state.log.push(`Could not add the blockset: ${describeError(error)}`);
    }
    finally {
      this.#adding = false;
    }
  }

  readonly #onEditRequest = (
    event: CustomEvent<TextureEditRequestDetail>
  ): void => {
    void this.#dialogs.query("blockset-edit-dialog").then(
      (dialog) => dialog.open(event.detail.id)
    );
  };

  override render() {
    const editing = this.editing;
    if (editing === null) {
      return nothing;
    }

    const addable = editing.access.current.has("blocksets");
    const { textureTabs } = editing.state;

    return html`
      ${editing.blocksets.entries.length === 0 ?
        this.#renderEmpty(addable) :
        html`
          <pixel-draw-panel
            texture-tabs="always"
            texture-add-label="Add blockset"
            textures-editable
            normal-map
            grid-size-locked
            .uvAccess=${this.uvAccess}
            .texturesAddable=${addable}
            .texturesClosable=${false}
            .textureTabsLine=${textureTabs.value === "line"}
            .fileDrops=${addable && editing.archives.canImport ? this.#blocksetDrops : kNoFileDrops}
            @texture-tabs-line-change=${(event: CustomEvent<boolean>) => {
              textureTabs.value = event.detail ? "line" : "tabs";
            }}
          ></pixel-draw-panel>
        `}
      ${this.#dialogs.render(() => html`
        <add-blockset-dialog></add-blockset-dialog>
        <blockset-edit-dialog .editing=${editing}></blockset-edit-dialog>
      `)}
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
