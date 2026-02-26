// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { VoxelRenderer, VoxelLayer, VoxelLayerHookEvent } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../EditorState.ts";
import type { Vec3 } from "./Vec3Input.ts";
import type { EventInput } from "./types.ts";

@customElement("layer-panel")
export class LayerPanel extends LitElement {
  static override styles = css`
    :host {
      display: block;
      background: #1a2228;
      border-top: 1px solid #2a3540;
      padding: 8px;
      font-size: 13px;
      color: #ccc;
    }
    .panel-title {
      font-size: 11px;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    label {
      min-width: 70px;
      color: #aaa;
      font-size: 12px;
    }
    input[type="checkbox"] {
      accent-color: #4488ff;
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 10px 0 5px;
    }
    .prop-row {
      display: flex;
      gap: 4px;
      margin-bottom: 4px;
    }
    .prop-row input[type="text"] {
      flex: 1;
      background: #111a20;
      border: 1px solid #333;
      color: #eee;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 12px;
    }
    .prop-row button {
      background: transparent;
      border: none;
      color: #ff5555;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0 2px;
    }
    .add-btn {
      background: transparent;
      border: 1px dashed #444;
      color: #888;
      font-size: 12px;
      cursor: pointer;
      width: 100%;
      padding: 3px;
      border-radius: 3px;
      margin-top: 2px;
    }
    .add-btn:hover {
      border-color: #4488ff;
      color: #4488ff;
    }
  `;

  @property({ attribute: false }) declare vr: VoxelRenderer;
  @property({ type: String }) declare layerName: string | null;

  @state() private declare _layer: VoxelLayer | null;
  @state() private declare _offset: Vec3;
  @state() private declare _visible: boolean;
  @state() private declare _props: Array<{ key: string; value: string; }>;

  constructor() {
    super();
    this.layerName = null;
    this._layer = null;
    this._offset = { x: 0, y: 0, z: 0 };
    this._visible = true;
    this._props = [];
  }

  #onLayerUpdated = (event: Event) => {
    const evt = (event as CustomEvent<VoxelLayerHookEvent>).detail;
    if (evt.layerName !== this.layerName || evt.action !== "offset-updated") {
      return;
    }
    this.#syncFromLayer();
  };

  override connectedCallback() {
    super.connectedCallback();
    editorState.addEventListener("layerUpdated", this.#onLayerUpdated);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    editorState.removeEventListener("layerUpdated", this.#onLayerUpdated);
  }

  override willUpdate(
    changed: Map<string, unknown>
  ) {
    if (changed.has("layerName") || changed.has("vr")) {
      this.#syncFromLayer();
    }
  }

  #syncFromLayer(): void {
    if (!this.vr || !this.layerName) {
      this._layer = null;

      return;
    }

    const layer = this.vr.getLayer(this.layerName) ?? null;
    this._layer = layer;

    if (layer) {
      this._offset = { x: layer.offset.x, y: layer.offset.y, z: layer.offset.z };
      this._visible = layer.visible;
      this._props = Object.entries(layer.properties ?? {}).map(
        ([k, v]) => {
          return { key: k, value: String(v) };
        }
      );
    }
  }

  override render() {
    if (!this._layer) {
      return nothing;
    }

    return html`
      <div class="panel-title">Layer: ${this.layerName}</div>

      <div class="row">
        <label>Visible</label>
        <input
          type="checkbox"
          ?checked=${this._visible}
          @change=${this.#onVisibleChange}
        />
      </div>

      <div class="section-title">Offset</div>
      <vec3-input
        .x=${this._offset.x}
        .y=${this._offset.y}
        .z=${this._offset.z}
        @change=${this.#onOffsetChange}
      ></vec3-input>

      <div class="section-title">Custom Properties</div>
      ${this._props.map((prop, idx) => html`
        <div class="prop-row">
          <input
            type="text"
            placeholder="key"
            .value=${prop.key}
            @change=${(event: EventInput) => this.#onPropKeyChange(idx, event)}
          />
          <input
            type="text"
            placeholder="value"
            .value=${prop.value}
            @change=${(event: EventInput) => this.#onPropValueChange(idx, event)}
          />
          <button @click=${() => this.#removeProperty(idx)}>×</button>
        </div>
      `)}
      <button class="add-btn" @click=${this.#addProperty}>+ Add property</button>
    `;
  }

  #onVisibleChange(
    event: EventInput
  ): void {
    if (!this.layerName) {
      return;
    }

    this._visible = event.target.checked;
    this.vr.updateLayer(this.layerName, { visible: this._visible });
    this.vr.markAllChunksDirty();
  }

  #onOffsetChange(
    event: CustomEvent<Vec3>
  ): void {
    if (!this.layerName) {
      return;
    }

    this._offset = event.detail;
    this.vr.setLayerOffset(this.layerName, this._offset);
    this.vr.markAllChunksDirty();
  }

  #onPropKeyChange(
    idx: number,
    event: EventInput
  ): void {
    this._props[idx].key = event.target.value;
    this.#flushProperties();
  }

  #onPropValueChange(
    idx: number,
    event: EventInput
  ): void {
    this._props[idx].value = event.target.value;
    this.#flushProperties();
  }

  #addProperty(): void {
    this._props = [
      ...this._props,
      { key: "", value: "" }
    ];
  }

  #removeProperty(
    idx: number
  ): void {
    this._props = this._props.filter((_, index) => index !== idx);
    this.#flushProperties();
  }

  #flushProperties(): void {
    if (!this.layerName) {
      return;
    }

    const props: Record<string, string> = {};
    for (const { key, value } of this._props) {
      if (key.trim()) {
        props[key.trim()] = value;
      }
    }
    this.vr.updateLayer(this.layerName, { properties: props });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "layer-panel": LayerPanel;
  }
}
