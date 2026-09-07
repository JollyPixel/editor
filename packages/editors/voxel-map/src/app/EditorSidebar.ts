// Import Third-party Dependencies
import { LitElement, html, css, nothing, render } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type {
  JollyTabChangeDetail,
  PresencePeer
} from "@jolly-pixel/ui";
import type {
  VoxelEngine,
  VoxelWorld,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import type * as network from "@jolly-pixel/network";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  editorState,
  isSidebarTab,
  type EditorState,
  type LayerSelection,
  type SidebarTab
} from "./state/index.ts";
import type {
  BlockLibrary,
  BlockSelectionChangeDetail
} from "../features/blocks/BlockLibrary.ts";
import type { LayerManager } from "../features/layers/LayerManager.ts";
import type { GridRenderer } from "../scene/GridRenderer.ts";
import { ViewFocus } from "../scene/viewFocus.ts";

import "../features/registerElements.ts";

// CONSTANTS
const kBlockLibrarySlot = "block-library";

@customElement("editor-sidebar")
export class EditorSidebar extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    jolly-tabs {
      flex: 1 1 auto;
      min-height: 0;
    }

    jolly-tabs::part(tab) {
      flex: 1 1 0;
    }

    jolly-tab {
      overflow-y: auto;
    }

    jolly-tab[value="paint"],
    jolly-tab[value="blocks"] {
      overflow-y: hidden;
    }

    jolly-tab[value="layers"] {
      --jolly-folder-indent: 0;
      --jolly-field-inset-end: 0;
    }

    .column {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    .column jolly-folder {
      flex: 0 0 auto;
    }

    .blocks jolly-folder {
      flex: 1 1 auto;
      min-height: 0;
    }

    texture-editor {
      flex: 1 1 auto;
      min-height: 0;
    }

    .hint {
      margin: 0;
      padding: var(--jolly-space-1, 4px);
      color: var(--jolly-text-muted);
    }
  `;

  @property({ attribute: false })
  declare engine: VoxelEngine | undefined;

  get world(): VoxelWorld | undefined {
    return this.engine?.world;
  }

  @property({ attribute: false })
  declare gridRenderer: GridRenderer | undefined;

  @property({ attribute: false })
  declare textureRoom: network.Room<PixelNetworkCommand, PixelServerMessage> | undefined;

  @property({ attribute: false })
  declare onLoadWorld: ((data: VoxelWorldJSON) => void) | undefined;

  @property({ attribute: false })
  declare state: EditorState;

  @property({ attribute: false })
  declare viewFocus: ViewFocus;

  @state()
  private declare _tab: SidebarTab;

  @state()
  private declare _selection: LayerSelection;

  @state()
  private declare _peers: readonly PresencePeer[];

  @state()
  private declare _canEditBlock: boolean;

  @query("jolly-folder[key='block-library']")
  private declare _blockFolder: HTMLElementTagNameMap["jolly-folder"] | null;

  @query("jolly-folder[key='layers']")
  private declare _layersFolder: HTMLElementTagNameMap["jolly-folder"] | null;

  @query("layer-manager")
  private declare _layerManager: LayerManager | null;

  get #blockLibrary(): BlockLibrary | null {
    return this.querySelector("block-library");
  }

  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this.engine = undefined;
    this.state = editorState;
    this.viewFocus = new ViewFocus();
    this._tab = "general";
    this._selection = null;
    this._peers = this.state.shell.peers;
    this._canEditBlock = false;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      this.state.selection.watch("change", this.#onSelectionChange),
      this.state.shell.watch("tabChange", this.#onTabStateChange),
      this.state.shell.watch("peersChange", this.#onPeersChange)
    );
    this.#onSelectionChange(this.state.selection.current);
    this.#onTabStateChange(this.state.shell.tab);
    this.#onPeersChange(this.state.shell.peers);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  readonly #onSelectionChange = (selection: LayerSelection): void => {
    this._selection = selection;
  };

  readonly #onTabStateChange = (tab: SidebarTab): void => {
    this._tab = tab;
  };

  readonly #onPeersChange = (peers: readonly PresencePeer[]): void => {
    this._peers = peers;
  };

  readonly #onBlockSelectionChange = (
    event: CustomEvent<BlockSelectionChangeDetail>
  ): void => {
    this._canEditBlock = event.detail.block !== null;
  };

  readonly #addBlock = async(): Promise<void> => {
    this.#openBlockLibrary();
    await this.#blockLibrary?.addBlock();
  };

  readonly #editBlock = async(): Promise<void> => {
    this.#openBlockLibrary();
    await this.#blockLibrary?.editBlock();
  };

  readonly #addLayer = async(): Promise<void> => {
    this.#openFolder(this._layersFolder);
    await this._layerManager?.addLayer();
  };

  readonly #removeLayer = async(): Promise<void> => {
    await this._layerManager?.removeLayer();
  };

  readonly #cloneLayer = (): void => {
    this._layerManager?.cloneLayer();
  };

  readonly #mergeLayer = async(): Promise<void> => {
    await this._layerManager?.mergeLayer();
  };

  get #canEditVoxelLayer(): boolean {
    return this._selection?.kind === "voxel-layer";
  }

  get #canMergeVoxelLayer(): boolean {
    return this.#canEditVoxelLayer &&
      (this.world?.getLayers().length ?? 0) > 1;
  }

  #openBlockLibrary(): void {
    this.#openFolder(this._blockFolder);
  }

  #openFolder(
    folder: HTMLElementTagNameMap["jolly-folder"] | null
  ): void {
    if (folder !== null && !folder.open) {
      folder.open = true;
    }
  }

  override render() {
    return html`
      <jolly-tabs
        .value=${this._tab}
        @jolly-tab-change=${this.#onTabChange}
      >
        <jolly-tab value="general" label="General">
          ${this.#renderGeneral()}
        </jolly-tab>
        <jolly-tab value="paint" label="Paint">
          ${this.#renderPaint()}
        </jolly-tab>
        <jolly-tab value="blocks" label="Blocks">
          ${this.#renderBlocks()}
        </jolly-tab>
        <jolly-tab value="layers" label="Layers">
          ${this.#renderLayers()}
        </jolly-tab>
      </jolly-tabs>
    `;
  }

  protected override updated(): void {
    render(this.#renderBlockLibrary(), this);
  }

  #onTabChange(
    event: CustomEvent<JollyTabChangeDetail>
  ): void {
    const { value } = event.detail;
    if (isSidebarTab(value)) {
      this.state.shell.tab = value;
    }
  }

  #renderBlockLibrary() {
    return html`
      <block-library
        slot=${kBlockLibrarySlot}
        .engine=${this.engine}
        .brush=${this.state.brush}
        .worldStore=${this.state.world}
        .layout=${this._tab === "blocks" ? "fill" : "compact"}
        @block-selection-change=${this.#onBlockSelectionChange}
      ></block-library>
    `;
  }

  #renderBlockLibrarySlot(
    tab: SidebarTab
  ) {
    return this._tab === tab ?
      html`<slot name=${kBlockLibrarySlot}></slot>` :
      nothing;
  }

  #renderBlockActions(
    slotName?: string
  ) {
    return html`
      <jolly-button
        slot=${slotName ?? nothing}
        icon="plus"
        icon-only
        label="Add block"
        title="Add block"
        @click=${this.#addBlock}
      ></jolly-button>
      <jolly-button
        slot=${slotName ?? nothing}
        icon="pencil"
        icon-only
        label="Edit block"
        title="Edit block"
        ?disabled=${!this._canEditBlock}
        @click=${this.#editBlock}
      ></jolly-button>
    `;
  }

  #renderGeneral() {
    return html`
      ${this.#renderCollaborators()}

      <jolly-folder
        key="map-config"
        label="Map Config"
        storage-key="voxel-map:folder:map-config"
      >
        <map-config-panel
          .engine=${this.engine}
          .gridRenderer=${this.gridRenderer}
          .onLoadWorld=${this.onLoadWorld}
          @world-loaded=${() => this.requestUpdate()}
        ></map-config-panel>
      </jolly-folder>
    `;
  }

  #renderCollaborators() {
    if (this._peers.length === 0) {
      return nothing;
    }

    return html`
      <jolly-folder
        key="collaborators"
        label="Collaborators"
        storage-key="voxel-map:folder:collaborators"
      >
        <jolly-presence .peers=${this._peers}></jolly-presence>
      </jolly-folder>
    `;
  }

  #renderLayers() {
    return html`
      <jolly-folder
        key="layers"
        label="Layers"
        storage-key="voxel-map:folder:layers"
      >
        <jolly-button
          slot="actions"
          icon="plus"
          icon-only
          label="Add layer"
          title="Add layer"
          @click=${this.#addLayer}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="copy"
          icon-only
          label="Clone layer"
          title="Clone layer"
          ?disabled=${!this.#canEditVoxelLayer}
          @click=${this.#cloneLayer}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="merge"
          icon-only
          label="Merge layer"
          title="Merge layer into another"
          ?disabled=${!this.#canMergeVoxelLayer}
          @click=${this.#mergeLayer}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="trash"
          icon-only
          variant="danger"
          label="Remove layer"
          title="Remove layer"
          ?disabled=${this._selection === null}
          @click=${this.#removeLayer}
        ></jolly-button>

        <layer-manager
          .world=${this.world}
          .selection=${this.state.selection}
          .worldStore=${this.state.world}
          .viewFocus=${this.viewFocus}
          style="height:200px;"
        ></layer-manager>
        ${this.#renderSelectionPanel()}
      </jolly-folder>
    `;
  }

  #renderSelectionPanel() {
    const selection = this._selection;
    if (selection === null) {
      return nothing;
    }

    switch (selection.kind) {
      case "voxel-layer":
        return html`<layer-panel
          .world=${this.world}
          .selection=${this.state.selection}
          .worldStore=${this.state.world}
          .layerName=${selection.name}
        ></layer-panel>`;
      case "object":
        return html`<object-panel
          .world=${this.world}
          .worldStore=${this.state.world}
          .layerName=${selection.layerName}
          .objectId=${selection.objectId}
        ></object-panel>`;
      default:
        return html`<p class="hint">
          Select an object to edit its properties.
        </p>`;
    }
  }

  #renderPaint() {
    return html`
      <div class="column">
        <jolly-folder
          flush
          key="block-library"
          label="Block Library"
          storage-key="voxel-map:folder:block-library"
        >
          ${this.#renderBlockActions("actions")}
          ${this.#renderBlockLibrarySlot("paint")}
        </jolly-folder>

        <texture-editor
          .engine=${this.engine}
          .brush=${this.state.brush}
          .worldStore=${this.state.world}
          .active=${this._tab === "paint"}
          .room=${this.textureRoom}
        ></texture-editor>
      </div>
    `;
  }

  #renderBlocks() {
    return html`
      <div class="column blocks">
        <jolly-folder
          .collapsible=${false}
          flush
          key="block-library-fill"
          label="Block Library"
        >
          ${this.#renderBlockActions("actions")}
          ${this.#renderBlockLibrarySlot("blocks")}
        </jolly-folder>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "editor-sidebar": EditorSidebar;
  }
}
