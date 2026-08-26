// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { VoxelRenderer, VoxelLayer, VoxelLayerHookEvent } from "@jolly-pixel/voxel.renderer";
import type { JollyChangeDetail, Vec3Like } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { editorState } from "../../EditorState.ts";

@customElement("layer-panel")
export class LayerPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding: var(--jolly-space-1, 4px);
      border-top: 1px solid var(--jolly-groove);
    }

    .panel-title {
      color: var(--jolly-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .prop-row {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
    }
    .prop-row jolly-text {
      flex: 1;
      min-width: 0;
    }
  `;

  @property({ attribute: false })
  declare vr: VoxelRenderer;
  @property({ type: String })
  declare layerName: string | null;

  @state()
  private declare _layer: VoxelLayer | null;
  @state()
  private declare _offset: Vec3Like;
  @state()
  private declare _gizmo: boolean;
  @state()
  private declare _props: Array<{ key: string; value: string; }>;
  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this.layerName = null;
    this._layer = null;
    this._offset = { x: 0, y: 0, z: 0 };
    this._gizmo = false;
    this._props = [];
  }

  #onLayerUpdated = (evt: VoxelLayerHookEvent) => {
    if (
      evt.layerName !== this.layerName ||
      evt.action !== "offset-updated"
    ) {
      return;
    }
    this.#syncFromLayer();
  };

  #onGizmoLayerChange = () => {
    this._gizmo = editorState.gizmoLayer === this.layerName;
  };

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      editorState.on("layerUpdated", this.#onLayerUpdated),
      editorState.on("gizmoLayerChange", this.#onGizmoLayerChange)
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  override willUpdate(
    changed: Map<string, unknown>
  ) {
    if (
      changed.has("layerName") ||
      changed.has("vr")
    ) {
      this.#syncFromLayer();
    }
  }

  #syncFromLayer(): void {
    if (!this.vr || !this.layerName) {
      this._layer = null;

      return;
    }

    const layer = this.vr.engine.getLayer(this.layerName) ?? null;
    this._layer = layer;

    if (layer) {
      this._offset = { x: layer.offset.x, y: layer.offset.y, z: layer.offset.z };
      this._gizmo = editorState.gizmoLayer === this.layerName;
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

      <jolly-checkbox
        align="end"
        label="Gizmo"
        .value=${this._gizmo}
        @jolly-change=${this.#onGizmoChange}
      ></jolly-checkbox>

      <jolly-vector3
        label="Offset"
        step="1"
        .value=${this._offset}
        @jolly-change=${this.#onOffsetChange}
      ></jolly-vector3>

      <jolly-folder
        key="layer-properties"
        label="Custom Properties"
        storage-key="voxel-map:folder:layer-properties"
      >
        ${this._props.map((prop, idx) => html`
          <div class="prop-row">
            <jolly-text
              placeholder="key"
              .value=${prop.key}
              @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => this.#onPropKeyChange(idx, event)}
            ></jolly-text>
            <jolly-text
              placeholder="value"
              .value=${prop.value}
              @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => this.#onPropValueChange(idx, event)}
            ></jolly-text>
            <jolly-button
              icon="close"
              icon-only
              variant="danger"
              label="Remove property"
              @click=${() => this.#removeProperty(idx)}
            ></jolly-button>
          </div>
        `)}
        <jolly-button @click=${this.#addProperty}>+ Add property</jolly-button>
      </jolly-folder>
    `;
  }

  #onGizmoChange(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    if (!this.layerName) {
      return;
    }

    this._gizmo = event.detail.value;
    editorState.setGizmoLayer(this._gizmo ? this.layerName : null);
  }

  #onOffsetChange(
    event: CustomEvent<JollyChangeDetail<Vec3Like>>
  ): void {
    if (!this.layerName) {
      return;
    }

    const { x, y, z } = event.detail.value;
    this._offset = {
      x: Math.round(x),
      y: Math.round(y),
      z: Math.round(z)
    };
    this.vr.engine.setLayerOffset(this.layerName, this._offset);
    this.vr.engine.markAllChunksDirty();
  }

  #onPropKeyChange(
    idx: number,
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this._props[idx].key = event.detail.value;
    this.#flushProperties();
  }

  #onPropValueChange(
    idx: number,
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this._props[idx].value = event.detail.value;
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
    this._props = this._props.filter(
      (_, index) => index !== idx
    );
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
    this.vr.engine.updateLayer(this.layerName, {
      properties: props
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "layer-panel": LayerPanel;
  }
}
