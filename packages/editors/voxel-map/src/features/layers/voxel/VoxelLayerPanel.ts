// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  isVoxelLayerGeometryCommand,
  type VoxelLayer,
  type VoxelLayerCommand,
  type VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { FieldBinding, type Vec3Like } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { MapDocument } from "../../../document/index.ts";
import type { SelectionStore } from "../../../state/index.ts";
import type { MapPlacement } from "../../placement/MapPlacement.ts";
import {
  propertiesOf,
  propertyRowsOf,
  type PropertyRow,
  type PropertyRowsChangeDetail
} from "../../../shared/propertyDraft.ts";
import {
  positionSource,
  roundPosition,
  samePosition
} from "../../../shared/positionSource.ts";
import "../../../shared/CustomPropertiesEditor.ts";
import "../../placement/PlacementActions.ts";

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
  declare placement: MapPlacement;

  @property({ attribute: false })
  declare mapDocument: MapDocument;

  @state()
  private declare _layer: VoxelLayer | null;

  @state()
  private declare _contentOrigin: Vec3Like;

  @state()
  private declare _props: PropertyRow[];
  #subscriptions: Array<() => void> = [];

  #position = new FieldBinding(this, positionSource({
    position: () => this._layer?.position ?? null,
    move: (position) => {
      if (this.layerName !== null) {
        this.world.setLayerPosition(this.layerName, position);
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
    if (event.layerName === this.layerName && isVoxelLayerGeometryCommand(event)) {
      this.#syncFromLayer();
    }
  };

  #onPlacementChange = () => {
    this.requestUpdate();
  };

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      this.mapDocument.subscribe("layerUpdated", this.#onLayerUpdated),
      this.placement.store.subscribe("change", this.#onPlacementChange)
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
      this._props = propertyRowsOf(this._layer?.properties);
    }
  }

  #syncFromLayer(): void {
    const layer = this.layerName ?
      this.world.getLayer(this.layerName) ?? null :
      null;
    this._layer = layer;
    if (layer) {
      const bounds = layer.worldBounds();
      this._contentOrigin = { ...(bounds?.min ?? layer.position) };
    }

    this.requestUpdate();
  }

  override render() {
    if (!this._layer) {
      return nothing;
    }

    return html`
      <jolly-separator label=${this.layerName ?? ""}>
        ${this.#renderActions()}
      </jolly-separator>

      ${this.#renderPosition()}

      <custom-properties-editor
        .rows=${this._props}
        storage-key="voxel-map:folder:layer-properties"
        @property-rows-change=${this.#onPropertyRowsChange}
      ></custom-properties-editor>
    `;
  }

  #renderActions() {
    const transforming = this.#transforming();
    const empty = this._layer?.worldBounds() === null;
    const transformTitle = empty ?
      "The layer has no voxels to transform" :
      "Move, turn or mirror the layer with a marquee";
    const origin = roundPosition(this._contentOrigin);
    const rebased = samePosition(origin, this.#position.value);

    return html`
      <jolly-button
        slot="actions"
        icon="transform"
        icon-only
        label="Transform"
        title=${transformTitle}
        ?disabled=${empty || transforming}
        @click=${this.#onTransform}
      ></jolly-button>
      <jolly-button
        slot="actions"
        icon="rebase"
        icon-only
        label="Rebase to content origin"
        title=${`Rebase to content origin (${origin.x}, ${origin.y}, ${origin.z})`}
        ?disabled=${rebased || transforming}
        @click=${this.#onRebase}
      ></jolly-button>
    `;
  }

  #renderPosition() {
    if (this.#transforming()) {
      return html`
        <placement-actions
          .placement=${this.placement}
          .target=${this.layerName}
        ></placement-actions>
      `;
    }

    return html`
      <jolly-vector3
        label="Position"
        step="1"
        .value=${this.#position.value}
        @jolly-input=${this.#position.input}
        @jolly-change=${this.#position.commit}
      ></jolly-vector3>
    `;
  }

  #transforming(): boolean {
    return this.layerName !== null &&
      this.placement.transforming(this.layerName);
  }

  #onTransform(): void {
    if (this.layerName !== null) {
      this.placement.transformLayer(this.layerName);
    }
  }

  #onRebase(): void {
    const { world, layerName } = this;
    if (!world || !layerName) {
      return;
    }

    world.rebaseLayer(layerName, roundPosition(this._contentOrigin));
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
