// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  editorState,
  type EditorState
} from "../state/index.ts";
import type {
  BlockLibrary,
  BlockSelectionChangeDetail
} from "../../features/blocks/BlockLibrary.ts";

import "../../features/registerElements.ts";

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

    :host(:not([hosts-texture-editor])) jolly-folder[open] {
      flex: 1 1 auto;
      min-height: 0;
    }
  `;

  @property({ attribute: false })
  declare engine: VoxelEngine | undefined;

  @property({ attribute: false })
  declare state: EditorState;

  @property({
    type: Boolean,
    reflect: true,
    attribute: "hosts-texture-editor"
  })
  declare hostsTextureEditor: boolean;

  @state()
  declare _canEditBlock: boolean;

  @query("jolly-folder")
  declare _folder: HTMLElementTagNameMap["jolly-folder"] | null;

  @query("block-library")
  declare _blockLibrary: BlockLibrary | null;

  constructor() {
    super();
    this.engine = undefined;
    this.state = editorState;
    this.hostsTextureEditor = false;
    this._canEditBlock = false;
  }

  readonly #onBlockSelectionChange = (
    event: CustomEvent<BlockSelectionChangeDetail>
  ): void => {
    this._canEditBlock = event.detail.block !== null;
  };

  readonly #addBlock = async(): Promise<void> => {
    this.#openFolder();
    await this._blockLibrary?.addBlock();
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
    return html`
      <jolly-folder
        flush
        key="block-library"
        label="Block Library"
        storage-key="voxel-map:folder:block-library"
      >
        <jolly-button
          slot="actions"
          icon="plus"
          icon-only
          label="Add block"
          title="Add block"
          @click=${this.#addBlock}
        ></jolly-button>
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
          .engine=${this.engine}
          .brush=${this.state.brush}
          .worldStore=${this.state.world}
          .presence=${this.state.presence}
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
