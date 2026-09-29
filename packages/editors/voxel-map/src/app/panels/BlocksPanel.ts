// Import Third-party Dependencies
import { html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  LocalStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import { BlockLibraryOrder } from "../../features/blocks/library/BlockLibraryOrder.ts";
import type { BlockOrderChangeDetail } from "../../features/blocks/library/BlockOrderMenu.ts";
import type { BlockLibrary } from "../../features/blocks/library/BlockLibrary.ts";
import "../../features/blocks/library/BlockLibrary.ts";
import "../../features/blocks/library/BlockOrderMenu.ts";

// CONSTANTS
const kOrderStorageKey = "voxel-map:block-library:order";

@customElement("blocks-panel")
export class BlocksPanel extends WorkspaceElement {
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

  @query("block-library")
  declare _blockLibrary: BlockLibrary | null;

  constructor() {
    super();
    this.hostsTextureEditor = false;
    this._canEditBlock = false;
    this.storage = new LocalStorageAdapter();
    this._order = BlockLibraryOrder.parse(this.storage.get(kOrderStorageKey));
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const refreshEditable = (): void => {
      const { blockId } = workspace.state.brush;
      this._canEditBlock = workspace.view.document.blocks.get(blockId) !== undefined;
    };
    refreshEditable();

    return [
      workspace.mapDocument.subscribe("reset", () => this.requestUpdate()),
      workspace.mapDocument.subscribe("blockRegistryChanged", refreshEditable),
      workspace.state.brush.subscribe("blockChange", refreshEditable)
    ];
  }

  readonly #onOrderChange = (
    event: CustomEvent<BlockOrderChangeDetail>
  ): void => {
    this._order = event.detail.order;
    this.storage.set(kOrderStorageKey, this._order.value);
  };

  readonly #editBlock = async(): Promise<void> => {
    this.#openFolder();
    await this._blockLibrary?.editBlock();
  };

  #openFolder(): void {
    if (this._folder !== null && !this._folder.open) {
      this._folder.open = true;
    }
  }

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return html`<slot></slot>`;
    }

    return html`
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
          .workspace=${workspace}
          .order=${this._order}
          .layout=${this.hostsTextureEditor ? "compact" : "fill"}
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
