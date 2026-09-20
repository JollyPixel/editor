// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  LocalStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../scene/EditorScene.ts";
import { WorkspaceController } from "../../shared/WorkspaceController.ts";
import {
  parseBlockLibraryOrder,
  type BlockLibraryOrder
} from "../../features/blocks/blockLibraryOrder.ts";
import type { BlockOrderChangeDetail } from "../../features/blocks/BlockOrderMenu.ts";
import type {
  BlockLibrary,
  BlockSelectionChangeDetail
} from "../../features/blocks/BlockLibrary.ts";
import type { TilesetFolder } from "../../features/tilesets/TilesetFolder.ts";

import "../../features/registerElements.ts";

// CONSTANTS
const kOrderStorageKey = "voxel-map:block-library:order";

@customElement("blocks-panel")
export class BlocksPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
    }

    jolly-folder {
      flex: 0 0 auto;
    }

    :host(:not([hosts-texture-editor])) jolly-folder.library[open] {
      flex: 1 1 auto;
      min-height: 0;
    }
  `;

  @property({
    type: Boolean,
    reflect: true,
    attribute: "hosts-texture-editor"
  })
  declare hostsTextureEditor: boolean;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  @state()
  declare _canEditBlock: boolean;

  @state()
  declare _order: BlockLibraryOrder;

  @query("jolly-folder.library")
  declare _folder: HTMLElementTagNameMap["jolly-folder"] | null;

  @query("jolly-folder.tilesets")
  declare _tilesetsFolder: HTMLElementTagNameMap["jolly-folder"] | null;

  @query("tileset-folder")
  declare _tilesetFolder: TilesetFolder | null;

  @query("block-library")
  declare _blockLibrary: BlockLibrary | null;

  #workspace = new WorkspaceController(this, (workspace) => [
    workspace.mapDocument.subscribe("reset", () => this.requestUpdate())
  ]);

  constructor() {
    super();
    this.hostsTextureEditor = false;
    this._canEditBlock = false;
    this.storage = new LocalStorageAdapter();
    this._order = parseBlockLibraryOrder(this.storage.get(kOrderStorageKey));
  }

  attach(
    workspace: VoxelMapWorkspace
  ): void {
    this.#workspace.attach(workspace);
  }

  readonly #onOrderChange = (
    event: CustomEvent<BlockOrderChangeDetail>
  ): void => {
    this._order = event.detail.order;
    this.storage.set(kOrderStorageKey, this._order);
  };

  readonly #onBlockSelectionChange = (
    event: CustomEvent<BlockSelectionChangeDetail>
  ): void => {
    this._canEditBlock = event.detail.block !== null;
  };

  readonly #editBlock = async(): Promise<void> => {
    this.#openFolder();
    await this._blockLibrary?.editBlock();
  };

  readonly #addTileset = async(): Promise<void> => {
    this.#openTilesetsFolder();
    await this._tilesetFolder?.addTileset();
  };

  readonly #manageTilesets = async(): Promise<void> => {
    await this._tilesetFolder?.manageTilesets();
  };

  #openTilesetsFolder(): void {
    if (this._tilesetsFolder !== null && !this._tilesetsFolder.open) {
      this._tilesetsFolder.open = true;
    }
  }

  #openFolder(): void {
    if (this._folder !== null && !this._folder.open) {
      this._folder.open = true;
    }
  }

  override render() {
    const workspace = this.#workspace.current;
    if (workspace === null) {
      return html`<slot></slot>`;
    }

    const editable = workspace.tilesetActions !== null;

    return html`
      <jolly-folder
        class="tilesets"
        flush
        key="tilesets"
        label="Tilesets"
        storage-key="voxel-map:folder:tilesets"
      >
        <jolly-button
          slot="actions"
          icon="plus"
          icon-only
          label="Add tileset"
          title="Add tileset"
          ?disabled=${!editable}
          @click=${this.#addTileset}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="sliders"
          icon-only
          label="Manage tilesets"
          title="Manage tilesets"
          @click=${this.#manageTilesets}
        ></jolly-button>
        <tileset-folder
          .engine=${workspace.engine}
          .actions=${workspace.tilesetActions}
          .tilesets=${workspace.state.tilesets}
          .mapDocument=${workspace.mapDocument}
          .usage=${workspace.usage}
          .log=${workspace.state.log}
        ></tileset-folder>
      </jolly-folder>

      <jolly-folder
        class="library"
        flush
        key="block-library"
        label="Block Library"
        storage-key="voxel-map:folder:block-library"
      >
        <block-order-menu
          slot="actions"
          .value=${this._order}
          @block-order-change=${this.#onOrderChange}
        ></block-order-menu>
        <jolly-button
          slot="actions"
          icon="pencil"
          icon-only
          label="Edit block"
          title="Edit block"
          ?disabled=${!this._canEditBlock}
          @click=${this.#editBlock}
        ></jolly-button>
        <block-library
          .engine=${workspace.engine}
          .brush=${workspace.state.brush}
          .mapDocument=${workspace.mapDocument}
          .presence=${workspace.state.presence}
          .tilesets=${workspace.state.tilesets}
          .usage=${workspace.usage}
          .order=${this._order}
          .layout=${this.hostsTextureEditor ? "compact" : "fill"}
          @block-selection-change=${this.#onBlockSelectionChange}
        ></block-library>
      </jolly-folder>

      <slot></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "blocks-panel": BlocksPanel;
  }
}
