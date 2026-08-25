// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { JollyTabChangeDetail } from "@jolly-pixel/ui";
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
} from "../EditorState.ts";
import type { GridRenderer } from "../components/GridRenderer.ts";

// Registers child custom elements.
import "./MapConfigPanel.ts";
import "./LayerManager.ts";
import "./LayerPanel.ts";
import "./ObjectLayerPanel.ts";
import "./BlockLibrary.ts";
import "./TextureEditor.ts";

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

    /*
     * The pane's own inset is off (see main.css) so the paint tab can run edge
     * to edge; the tabs that hold controls carry the gutter themselves.
     */
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
  private declare _selectedLayer: string | null;
  @state()
  private declare _selectedLayerType: "voxel" | "object" | null;
  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this._tab = "general";
    this._selectedLayer = null;
    this._selectedLayerType = null;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      editorState.on("selectionChange", this.#onSelectionChange),
      editorState.on("activeSidebarTabChange", this.#onTabStateChange)
    );
    this.#onSelectionChange(editorState.selection);
    this.#onTabStateChange(editorState.activeSidebarTab);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  readonly #onSelectionChange = (selection: LayerSelection): void => {
    this._selectedLayer = selection?.name ?? null;
    this._selectedLayerType = selection?.type ?? null;
  };

  readonly #onTabStateChange = (tab: SidebarTab): void => {
    this._tab = tab;
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

  #renderLayers() {
    let layerPanel: unknown = null;
    if (this._selectedLayer) {
      if (this._selectedLayerType === "object") {
        layerPanel = html`<object-layer-panel
                .vr=${this.vr}
                .layerName=${this._selectedLayer}
              ></object-layer-panel>`;
      }
      else {
        layerPanel = html`<layer-panel
                .vr=${this.vr}
                .layerName=${this._selectedLayer}
              ></layer-panel>`;
      }
    }

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
        ${layerPanel}
      </jolly-folder>
    `;
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
