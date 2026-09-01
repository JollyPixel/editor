// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type {
  JollyTabChangeDetail,
  PresencePeer
} from "@jolly-pixel/ui";
import type { VoxelRenderer, VoxelWorldJSON } from "@jolly-pixel/voxel.renderer";
import type * as network from "@jolly-pixel/network";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  editorState,
  type LayerSelection,
  type SidebarTab
} from "../../EditorState.ts";
import type { GridRenderer } from "../../components/GridRenderer.ts";

// Registers child custom elements.
import "../map-config/MapConfigPanel.ts";
import "../layers/LayerManager.ts";
import "../layers/LayerPanel.ts";
import "../object-layers/ObjectPanel.ts";
import "../blocks/BlockLibrary.ts";
import "../texture/TextureEditor.ts";

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

    /* Tab panes own their gutter because paint content runs edge to edge. */
    jolly-tab {
      overflow-y: auto;
      padding: var(--jolly-space-1, 4px);
    }

    jolly-tab[value="paint"] {
      overflow-y: hidden;
      padding: 0;
    }

    texture-editor {
      height: 100%;
    }

    .hint {
      margin: 0;
      padding: var(--jolly-space-1, 4px);
      color: var(--jolly-text-muted);
    }
  `;

  @property({ attribute: false })
  declare vr: VoxelRenderer | undefined;
  @property({ attribute: false })
  declare gridRenderer: GridRenderer | undefined;
  @property({ attribute: false })
  declare textureRoom: network.Room<PixelNetworkCommand, PixelServerMessage> | undefined;
  @property({ attribute: false })
  declare onLoadWorld: ((data: VoxelWorldJSON) => void) | undefined;

  @state()
  private declare _tab: SidebarTab;
  @state()
  private declare _selection: LayerSelection;
  @state()
  private declare _peers: readonly PresencePeer[];
  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this._tab = "general";
    this._selection = null;
    this._peers = editorState.peers;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      editorState.on("selectionChange", this.#onSelectionChange),
      editorState.on("activeSidebarTabChange", this.#onTabStateChange),
      editorState.on("peersChange", this.#onPeersChange)
    );
    this.#onSelectionChange(editorState.selection);
    this.#onTabStateChange(editorState.activeSidebarTab);
    this.#onPeersChange(editorState.peers);
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
        <jolly-tab value="layers" label="Layers">
          ${this.#renderLayers()}
        </jolly-tab>
      </jolly-tabs>
    `;
  }

  #onTabChange(
    event: CustomEvent<JollyTabChangeDetail>
  ): void {
    editorState.setActiveSidebarTab(event.detail.value as SidebarTab);
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
          .vr=${this.vr}
          .gridRenderer=${this.gridRenderer}
          .onLoadWorld=${this.onLoadWorld}
          @world-loaded=${() => this.requestUpdate()}
        ></map-config-panel>
      </jolly-folder>

      <jolly-folder
        key="block-library"
        label="Block Library"
        storage-key="voxel-map:folder:block-library"
      >
        <block-library
          .vr=${this.vr}
          style="flex:1;min-height:200px;"
        ></block-library>
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
        <layer-manager
          .vr=${this.vr}
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
          .vr=${this.vr}
          .layerName=${selection.name}
        ></layer-panel>`;
      case "object":
        return html`<object-panel
          .vr=${this.vr}
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
      <texture-editor
        .vr=${this.vr}
        .active=${this._tab === "paint"}
        .room=${this.textureRoom}
      ></texture-editor>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "editor-sidebar": EditorSidebar;
  }
}
