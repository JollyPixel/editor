// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type {
  VoxelLayer,
  VoxelLayerCommand,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { FieldBinding, type Vec3Like } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { MapDocument } from "../../../document/index.ts";
import type { SelectionStore } from "../../../state/index.ts";
import {
  propertiesOf,
  propertyRowsOf,
  type PropertyRow,
  type PropertyRowsChangeDetail
} from "../properties/propertyDraft.ts";
import {
  gizmoSource,
  layerPositionSource,
  roundPosition,
  samePosition
} from "./layerSources.ts";
import "../properties/CustomPropertiesEditor.ts";

@customElement("layer-panel")
export class VoxelLayerPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding: var(--jolly-space-1, 4px);
    }

  `;

  @property({ attribute: false })
  declare world: VoxelWorld;

  @property({ type: String })
  declare layerName: string | null;

  @property({ attribute: false })
  declare selection: SelectionStore;

  @property({ attribute: false })
  declare mapDocument: MapDocument;

  @state()
  private declare _layer: VoxelLayer | null;

  @state()
  private declare _contentOrigin: Vec3Like;

  @state()
  private declare _props: PropertyRow[];
  #subscriptions: Array<() => void> = [];

  #position = new FieldBinding(this, layerPositionSource({
    position: () => this._layer?.position ?? null,
    move: (position) => {
      if (this.layerName !== null) {
        this.world.setLayerPosition(this.layerName, position);
      }
    }
  }));

  #gizmo = new FieldBinding(this, gizmoSource({
    enabled: () => this.selection.gizmoLayer === this.layerName,
    toggle: (enabled) => {
      if (this.layerName !== null) {
        this.selection.gizmoLayer = enabled ? this.layerName : null;
      }
    }
  }));

  constructor() {
    super();
    this.layerName = null;
    this._layer = null;
    this._contentOrigin = { x: 0, y: 0, z: 0 };
    this._props = [];
  }

  #onLayerUpdated = (event: VoxelLayerCommand) => {
    if (
      event.layerName !== this.layerName ||
      event.action !== "position-updated" &&
      event.action !== "position-rebased" &&
      event.action !== "voxel-set" &&
      event.action !== "voxel-removed" &&
      event.action !== "voxels-set" &&
      event.action !== "voxels-removed"
    ) {
      return;
    }
    this.#syncFromLayer();
  };

  #onGizmoLayerChange = () => {
    this.requestUpdate();
  };

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      this.mapDocument.subscribe("layerUpdated", this.#onLayerUpdated),
      this.selection.subscribe("gizmoLayerChange", this.#onGizmoLayerChange)
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
      changed.has("world")
    ) {
      this.#syncFromLayer();
    }
  }

  #syncFromLayer(): void {
    if (!this.layerName) {
      this._layer = null;

      return;
    }

    const layer = this.world.getLayer(this.layerName) ?? null;
    this._layer = layer;

    if (layer) {
      const bounds = layer.worldBounds();
      this._contentOrigin = { ...(bounds?.min ?? layer.position) };
      this._props = propertyRowsOf(layer.properties);
    }

    this.requestUpdate();
  }

  override render() {
    if (!this._layer) {
      return nothing;
    }

    return html`
      <jolly-separator label=${this.layerName ?? ""}></jolly-separator>

      <jolly-checkbox
        align="end"
        label="Gizmo"
        .value=${this.#gizmo.value}
        @jolly-change=${this.#gizmo.commit}
      ></jolly-checkbox>

      <jolly-vector3
        label="Position"
        step="1"
        .value=${this.#position.value}
        @jolly-input=${this.#position.input}
        @jolly-change=${this.#position.commit}
      ></jolly-vector3>

      <jolly-vector3
        label="Content origin"
        disabled
        .value=${this._contentOrigin}
      ></jolly-vector3>

      <jolly-button
        ?disabled=${samePosition(roundPosition(this._contentOrigin), this.#position.value)}
        @click=${this.#onRebase}
      >Rebase to content origin</jolly-button>

      <custom-properties-editor
        .rows=${this._props}
        storage-key="voxel-map:folder:layer-properties"
        @property-rows-change=${this.#onPropertyRowsChange}
      ></custom-properties-editor>
    `;
  }

  #onRebase(): void {
    const { world, layerName } = this;
    if (!world || !layerName) {
      return;
    }

    world.rebaseLayer(layerName, {
      x: Math.round(this._contentOrigin.x),
      y: Math.round(this._contentOrigin.y),
      z: Math.round(this._contentOrigin.z)
    });
  }

  #onPropertyRowsChange(
    event: CustomEvent<PropertyRowsChangeDetail>
  ): void {
    this._props = event.detail.rows;
    this.#flushProperties();
  }

  #flushProperties(): void {
    const { world, layerName } = this;
    if (!world || !layerName) {
      return;
    }

    world.updateLayer(layerName, {
      properties: propertiesOf(this._props)
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "layer-panel": VoxelLayerPanel;
  }
}
