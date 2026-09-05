// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  VoxelFootprint,
  type VoxelRenderer,
  type VoxelObjectJSON,
  type VoxelLayerHookEvent
} from "@jolly-pixel/voxel.renderer";
import type {
  JollyChangeDetail,
  Vec3Like
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { editorState } from "../../EditorState.ts";
import {
  colorOf,
  derivedColorOf
} from "./objectArea.ts";
import {
  propertiesOf,
  propertyRowsOf,
  type PropertyRow
} from "./propertyDraft.ts";

@customElement("object-panel")
export class ObjectPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding: var(--jolly-space-1, 4px);
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
  @property({ type: String })
  declare objectId: string | null;

  @state()
  private declare _object: VoxelObjectJSON | null;

  @state()
  private declare _props: PropertyRow[];

  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this.layerName = null;
    this.objectId = null;
    this._object = null;
    this._props = [];
  }

  readonly #onLayerUpdated = (evt: VoxelLayerHookEvent) => {
    if (
      evt.layerName !== this.layerName ||
      (
        evt.action !== "object-updated" &&
        evt.action !== "object-added" &&
        evt.action !== "object-removed"
      )
    ) {
      return;
    }
    this.#syncFromStore();
  };

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      editorState.on("layerUpdated", this.#onLayerUpdated)
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
      changed.has("objectId") ||
      changed.has("vr")
    ) {
      this.#syncFromStore({ resetProperties: true });
    }
  }

  #syncFromStore(
    options: { resetProperties?: boolean; } = {}
  ): void {
    if (!this.vr || !this.layerName || !this.objectId) {
      this._object = null;

      return;
    }

    const object = this.vr.engine.world
      .getObjectLayer(this.layerName)
      ?.objects.find((candidate) => candidate.id === this.objectId) ?? null;
    this._object = object;

    // Rows are rebuilt only when the panel switches object: rebuilding them
    // on every commit would drop the blank key of a half-typed row.
    if (object !== null && options.resetProperties === true) {
      this._props = propertyRowsOf(object.properties);
    }
  }

  override render() {
    const object = this._object;
    if (object === null) {
      return nothing;
    }

    const locked = object.locked ?? false;
    const footprint = VoxelFootprint.of(object);

    return html`
      <jolly-separator label=${object.name}></jolly-separator>

      <jolly-color
        label="Color"
        .value=${colorOf(object)}
        .default=${derivedColorOf(object)}
        @jolly-change=${this.#onColorChange}
      ></jolly-color>

      <jolly-vector3
        label="Position"
        step="1"
        ?disabled=${locked}
        .value=${{ x: object.x, y: object.y, z: object.z }}
        @jolly-change=${this.#onPositionChange}
      ></jolly-vector3>

      <jolly-vector2
        label="Size"
        axes="xz"
        step="1"
        min="1"
        ?disabled=${locked}
        .value=${{
          x: footprint.width,
          z: footprint.height
        }}
        @jolly-change=${this.#onSizeChange}
      ></jolly-vector2>

      ${this.#renderProperties()}
    `;
  }

  #renderProperties() {
    return html`
      <jolly-folder
        key="object-properties"
        label="Custom Properties"
        storage-key="voxel-map:folder:object-properties"
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

  #onColorChange(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    const value = event.detail.value;
    const object = this._object;

    const derived = object === null ? null : derivedColorOf(object);
    this.#patch({
      color: derived !== null && sameColor(value, derived)
        ? undefined
        : value
    });
  }

  #onPositionChange(
    event: CustomEvent<JollyChangeDetail<Vec3Like>>
  ): void {
    const { x, y, z } = event.detail.value;
    this.#patch({
      x: Math.round(x),
      y: Math.round(y),
      z: Math.round(z)
    });
  }

  #onSizeChange(
    event: CustomEvent<JollyChangeDetail<Record<"x" | "z", number>>>
  ): void {
    const { x: width, z: height } = event.detail.value;
    this.#patch(
      new VoxelFootprint(width, height).toJSON()
    );
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
    this.#patch({ properties: propertiesOf(this._props) });
  }

  #patch(
    patch: Partial<VoxelObjectJSON>
  ): void {
    if (!this.layerName || !this.objectId) {
      return;
    }

    this.vr.engine.world.updateObjectInLayer(this.layerName, this.objectId, patch);
    this.requestUpdate();
  }
}

function sameColor(
  left: string,
  right: string
): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

declare global {
  interface HTMLElementTagNameMap {
    "object-panel": ObjectPanel;
  }
}
