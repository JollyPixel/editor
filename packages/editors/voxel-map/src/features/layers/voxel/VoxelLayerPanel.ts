// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import * as THREE from "three";
import {
  type VoxelLayer,
  type VoxelLayerCommand,
  type VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { FieldBinding } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { MapDocument } from "../../../document/MapDocument.ts";
import type { SelectionStore } from "../../../state/index.ts";
import type { MapPlacement } from "../../placement/MapPlacement.ts";
import { PropertyRows } from "../../../shared/properties/PropertyRows.ts";
import type { PropertiesChangeDetail } from "../../../shared/properties/CustomPropertiesEditor.ts";
import { PositionSource } from "../../../shared/PositionSource.ts";
import "../../../shared/properties/CustomPropertiesEditor.ts";
import "../layerIcons.ts";
import "../../placement/placementIcons.ts";

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

  @property({ type: Boolean })
  declare writable: boolean;

  @state()
  private declare _layer: VoxelLayer | null;

  @state()
  private declare _contentOrigin: THREE.Vector3;

  @state()
  private declare _empty: boolean;

  #subscriptions: Array<() => void> = [];

  #position = new FieldBinding(this, new PositionSource({
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
    this.writable = true;
    this._layer = null;
    this._contentOrigin = new THREE.Vector3();
    this._empty = true;
  }

  #onLayerUpdated = (event: VoxelLayerCommand) => {
    if (
      "layerId" in event &&
      this.world.getLayerById(event.layerId)?.name === this.layerName
    ) {
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
      this.mapDocument.subscribe("reset", () => this.#syncFromLayer()),
      this.placement.subscribe("change", this.#onPlacementChange)
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
    const layer = this.layerName ?
      this.world.getLayer(this.layerName) ?? null :
      null;
    this._layer = layer;
    if (layer) {
      const bounds = layer.worldBounds();
      this._empty = bounds === null;
      this._contentOrigin = new THREE.Vector3()
        .copy(bounds?.min ?? layer.position)
        .round();
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

      ${keyed(this.layerName, html`
        <custom-properties-editor
          .properties=${this._layer.properties}
          .disabled=${!this.writable}
          @properties-change=${this.#onPropertiesChange}
        ></custom-properties-editor>
      `)}
    `;
  }

  #renderActions() {
    const transforming = !this.writable || this.#transforming();
    const empty = this._empty;
    const transformTitle = empty ?
      "The layer has no voxels to transform" :
      "Move, turn or mirror the layer with a marquee";
    const rebased = this._contentOrigin.equals(this.#position.value);

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
        title=${`Rebase to content origin (${this._contentOrigin.toArray().join(", ")})`}
        ?disabled=${rebased || transforming}
        @click=${this.#onRebase}
      ></jolly-button>
    `;
  }

  #renderPosition() {
    return html`
      <jolly-vector3
        label="Position"
        step="1"
        ?disabled=${!this.writable || this.#transforming()}
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

    world.rebaseLayer(layerName, this._contentOrigin);
  }

  #onPropertiesChange(
    event: CustomEvent<PropertiesChangeDetail>
  ): void {
    const {
      world,
      layerName,
      _layer: layer
    } = this;
    if (!world || !layerName || !layer) {
      return;
    }

    world.updateLayer(layerName, {
      properties: {
        ...PropertyRows.uneditable(layer.properties),
        ...event.detail.properties
      }
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "layer-panel": VoxelLayerPanel;
  }
}
