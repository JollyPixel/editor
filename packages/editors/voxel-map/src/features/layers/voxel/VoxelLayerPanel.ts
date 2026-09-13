// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type {
  VoxelLayer,
  VoxelLayerHookEvent,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import type { JollyChangeDetail, Vec3Like } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  editorState,
  type SelectionStore,
  type WorldStore
} from "../../../app/state/index.ts";
import {
  propertiesOf,
  propertyRowsOf,
  type PropertyRow,
  type PropertyRowsChangeDetail
} from "../properties/propertyDraft.ts";
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
  declare world: VoxelWorld | undefined;

  @property({ type: String })
  declare layerName: string | null;

  @property({ attribute: false })
  declare selection: SelectionStore;

  @property({ attribute: false })
  declare worldStore: WorldStore;

  @state()
  private declare _layer: VoxelLayer | null;

  @state()
  private declare _position: Vec3Like;

  @state()
  private declare _worldCenter: Vec3Like;

  @state()
  private declare _worldMin: Vec3Like;

  @state()
  private declare _worldMax: Vec3Like;

  @state()
  private declare _gizmo: boolean;

  @state()
  private declare _props: PropertyRow[];
  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this.world = undefined;
    this.selection = editorState.selection;
    this.worldStore = editorState.world;
    this.layerName = null;
    this._layer = null;
    this._position = { x: 0, y: 0, z: 0 };
    this._worldCenter = { x: 0, y: 0, z: 0 };
    this._worldMin = { x: 0, y: 0, z: 0 };
    this._worldMax = { x: 0, y: 0, z: 0 };
    this._gizmo = false;
    this._props = [];
  }

  #onLayerUpdated = (event: VoxelLayerHookEvent) => {
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
    this._gizmo = this.selection.gizmoLayer === this.layerName;
  };

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      this.worldStore.watch("layerUpdated", this.#onLayerUpdated),
      this.selection.watch("gizmoLayerChange", this.#onGizmoLayerChange)
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
    if (!this.world || !this.layerName) {
      this._layer = null;

      return;
    }

    const layer = this.world.getLayer(this.layerName) ?? null;
    this._layer = layer;

    if (layer) {
      this._position = {
        x: layer.position.x,
        y: layer.position.y,
        z: layer.position.z
      };
      const center = layer.worldCenter();
      const bounds = layer.worldBounds();
      this._worldCenter = { ...center };
      this._worldMin = { ...(bounds?.min ?? layer.position) };
      this._worldMax = { ...(bounds?.max ?? layer.position) };
      this._gizmo = this.selection.gizmoLayer === this.layerName;
      this._props = propertyRowsOf(layer.properties);
    }
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
        .value=${this._gizmo}
        @jolly-change=${this.#onGizmoChange}
      ></jolly-checkbox>

      <jolly-vector3
        label="Position"
        step="1"
        .value=${this._position}
        @jolly-input=${this.#onPositionChange}
        @jolly-change=${this.#onPositionChange}
      ></jolly-vector3>

      <jolly-vector3
        label="Content center"
        disabled
        .value=${this._worldCenter}
      ></jolly-vector3>

      <jolly-vector3
        label="Bounds minimum"
        disabled
        .value=${this._worldMin}
      ></jolly-vector3>

      <jolly-vector3
        label="Bounds maximum"
        disabled
        .value=${this._worldMax}
      ></jolly-vector3>

      <jolly-button
        @click=${this.#onRebase}
      >Rebase origin to minimum</jolly-button>

      <custom-properties-editor
        .rows=${this._props}
        storage-key="voxel-map:folder:layer-properties"
        @property-rows-change=${this.#onPropertyRowsChange}
      ></custom-properties-editor>
    `;
  }

  #onGizmoChange(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    if (!this.layerName) {
      return;
    }

    this._gizmo = event.detail.value;
    this.selection.gizmoLayer = this._gizmo ? this.layerName : null;
  }

  #onPositionChange(
    event: CustomEvent<JollyChangeDetail<Vec3Like>>
  ): void {
    const { world, layerName } = this;
    if (!world || !layerName) {
      return;
    }

    const { x, y, z } = event.detail.value;
    const position = {
      x: Math.round(x),
      y: Math.round(y),
      z: Math.round(z)
    };
    if (samePosition(position, this._position)) {
      return;
    }

    this._position = position;
    world.setLayerPosition(
      layerName,
      position
    );
  }

  #onRebase(): void {
    const { world, layerName } = this;
    if (!world || !layerName) {
      return;
    }

    world.rebaseLayer(layerName, {
      x: Math.round(this._worldMin.x),
      y: Math.round(this._worldMin.y),
      z: Math.round(this._worldMin.z)
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

function samePosition(
  left: Vec3Like,
  right: Vec3Like
): boolean {
  return left.x === right.x &&
    left.y === right.y &&
    left.z === right.z;
}

declare global {
  interface HTMLElementTagNameMap {
    "layer-panel": VoxelLayerPanel;
  }
}
