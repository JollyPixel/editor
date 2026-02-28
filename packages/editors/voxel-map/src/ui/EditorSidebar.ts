// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { VoxelRenderer } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState, type SidebarTab } from "../EditorState.ts";
import type { GridRenderer } from "../components/GridRenderer.ts";

// Side-effect imports — registers custom elements
import "./Icon.ts";
import "./MapConfigPanel.ts";
import "./LayerManager.ts";
import "./LayerPanel.ts";
import "./ObjectLayerPanel.ts";
import "./BlockLibrary.ts";
import "./TilesetManager.ts";
import "./TextureEditor.ts";
import "./Vec3Input.ts";
import "./Vec2Input.ts";

@customElement("editor-sidebar")
export class EditorSidebar extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 380px;
      flex-shrink: 0;
      background: #141a1d;
      color: #ccc;
      overflow: hidden;
      font-family: system-ui, sans-serif;
      font-size: 13px;
    }

    /* Tab bar */
    .tab-bar {
      display: flex;
      background: #0e1316;
      border-bottom: 2px solid #1e2a30;
      flex-shrink: 0;
    }
    .tab-bar button {
      flex: 1;
      background: transparent;
      border: none;
      color: #888;
      padding: 8px 0;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      transition: color 0.15s;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
    }
    .tab-bar button:hover { color: #ccc; }
    .tab-bar button.active {
      color: #4488ff;
      border-bottom-color: #4488ff;
    }

    /* Scrollable content */
    .content {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    /* Section wrappers */
    .box {
      border-bottom: 1px solid #1e2a30;
    }
    .box-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: #1a2228;
      font-size: 11px;
      font-weight: 700;
      color: #778899;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      cursor: pointer;
      user-select: none;
    }
    .box-title::after {
      content: attr(data-arrow);
      font-size: 9px;
    }
    .box-content {
      overflow: hidden;
    }
    .box-content.collapsed {
      display: none;
    }
  `;

  @property({ attribute: false }) declare vr: VoxelRenderer | undefined;
  @property({ attribute: false }) declare gridRenderer: GridRenderer | undefined;

  @state() private declare _tab: SidebarTab;
  @state() private declare _selectedLayer: string | null;
  @state() private declare _selectedLayerType: "voxel" | "object" | null;
  @state() private declare _collapsed: Record<string, boolean>;

  constructor() {
    super();
    this._tab = "general";
    this._selectedLayer = null;
    this._selectedLayerType = null;
    this._collapsed = {};
  }

  override connectedCallback() {
    super.connectedCallback();
    editorState.addEventListener("selectedLayerChange", () => {
      this._selectedLayer = editorState.selectedLayer;
    });
    editorState.addEventListener("selectedLayerTypeChange", () => {
      this._selectedLayerType = editorState.selectedLayerType;
    });
    editorState.addEventListener("activeSidebarTabChange", () => {
      this._tab = editorState.activeSidebarTab;
    });
  }

  override render() {
    return html`
      <div class="tab-bar">
        <button
          class=${this._tab === "general" ? "active" : ""}
          @click=${() => editorState.setActiveSidebarTab("general")}
        >General</button>
        <button
          class=${this._tab === "paint" ? "active" : ""}
          @click=${() => editorState.setActiveSidebarTab("paint")}
        >Paint</button>
        <button
          class=${this._tab === "layers" ? "active" : ""}
          @click=${() => editorState.setActiveSidebarTab("layers")}
        >Layers</button>
      </div>

      <div class="content">
        <div style=${this._tab === "general" ? "display:contents" : "display:none"}>
          ${this.#renderGeneral()}
        </div>
        <div style=${this._tab === "paint" ? "display:contents" : "display:none"}>
          ${this.#renderPaint()}
        </div>
        <div style=${this._tab === "layers" ? "display:contents" : "display:none"}>
          ${this.#renderLayers()}
        </div>
      </div>
    `;
  }

  #renderGeneral() {
    return html`
      ${this.#section("Map Config", html`
        <map-config-panel
          .vr=${this.vr}
          .gridRenderer=${this.gridRenderer}
          @world-loaded=${() => this.requestUpdate()}
        ></map-config-panel>
      `)}

      ${this.#section("Block Library", html`
        <block-library
          .vr=${this.vr}
          style="flex:1;min-height:200px;"
        ></block-library>
      `)}
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
      ${this.#section("Layers", html`
        <layer-manager
          .vr=${this.vr}
          style="height:200px;"
        ></layer-manager>
        ${layerPanel}
      `)}
    `;
  }

  #renderPaint() {
    return html`
      ${this.#section("TileSet Manager", html`
        <tileset-manager
          .vr=${this.vr}
          @tileset-added=${() => this.requestUpdate()}
        ></tileset-manager>
      `)}

      ${this.#section("Texture Editor", html`
        <texture-editor .vr=${this.vr} .active=${this._tab === "paint"}></texture-editor>
      `)}
    `;
  }

  #section(
    title: string,
    content: unknown
  ) {
    const key = title;
    const collapsed = this._collapsed[key] ?? false;

    return html`
      <div class="box">
        <div
          class="box-title"
          data-arrow=${collapsed ? "▸" : "▾"}
          @click=${() => {
            this._collapsed = {
              ...this._collapsed,
              [key]: !collapsed
            };
          }}
        >${title}</div>
        <div class="box-content ${collapsed ? "collapsed" : ""}">
          ${content}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "editor-sidebar": EditorSidebar;
  }
}
