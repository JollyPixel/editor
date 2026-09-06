// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
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
import type { GridRenderer } from "../scene/GridRenderer.ts";
import { ViewFocus } from "../scene/viewFocus.ts";

import "../features/registerElements.ts";

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
  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this.engine = undefined;
    this.state = editorState;
    this.viewFocus = new ViewFocus();
    this._tab = "general";
    this._selection = null;
    this._peers = this.state.shell.peers;
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
    const { value } = event.detail;
    if (isSidebarTab(value)) {
      this.state.shell.tab = value;
    }
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

      <jolly-folder
        key="block-library"
        label="Block Library"
        storage-key="voxel-map:folder:block-library"
      >
        <block-library
          .engine=${this.engine}
          .brush=${this.state.brush}
          .worldStore=${this.state.world}
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
      <texture-editor
        .engine=${this.engine}
        .brush=${this.state.brush}
        .worldStore=${this.state.world}
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
