// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  VoxelFootprint,
  type VoxelWorld,
  type VoxelObjectJSON,
  type VoxelLayerHookEvent
} from "@jolly-pixel/voxel.renderer";
import type {
  JollyChangeDetail,
  Vec3Like
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  editorState,
  type WorldStore
} from "../../../app/state/index.ts";
import {
  colorOf,
  derivedColorOf,
  isNoopPatch
} from "./objectArea.ts";
import {
  propertiesOf,
  propertyRowsOf,
  type PropertyRow,
  type PropertyRowsChangeDetail
} from "../properties/propertyDraft.ts";
import "../properties/CustomPropertiesEditor.ts";

@customElement("object-panel")
export class ObjectPanel extends LitElement {
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
  @property({ type: String })
  declare objectId: string | null;
  @property({ attribute: false })
  declare worldStore: WorldStore;

  @state()
  private declare _object: VoxelObjectJSON | null;

  @state()
  private declare _props: PropertyRow[];

  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this.world = undefined;
    this.worldStore = editorState.world;
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
      this.worldStore.watch("layerUpdated", this.#onLayerUpdated)
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
      changed.has("world")
    ) {
      this.#syncFromStore({ resetProperties: true });
    }
  }

  #syncFromStore(
    options: { resetProperties?: boolean; } = {}
  ): void {
    if (!this.world || !this.layerName || !this.objectId) {
      this._object = null;

      return;
    }

    const object = this.world
      .getObjectLayer(this.layerName)
      ?.objects.find((candidate) => candidate.id === this.objectId) ?? null;
    // The store mutates objects in place, so a snapshot is what makes the
    // reactive identity change and the panel re-render.
    this._object = object === null ? null : { ...object };

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
        @jolly-input=${this.#onColorChange}
        @jolly-change=${this.#onColorChange}
      ></jolly-color>

      <jolly-vector3
        label="Position"
        step="1"
        ?disabled=${locked}
        .value=${{ x: object.x, y: object.y, z: object.z }}
        @jolly-input=${this.#onPositionChange}
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
        @jolly-input=${this.#onSizeChange}
        @jolly-change=${this.#onSizeChange}
      ></jolly-vector2>

      ${this.#renderProperties()}
    `;
  }

  #renderProperties() {
    return html`<custom-properties-editor
      .rows=${this._props}
      storage-key="voxel-map:folder:object-properties"
      @property-rows-change=${this.#onPropertyRowsChange}
    ></custom-properties-editor>`;
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

  #onPropertyRowsChange(
    event: CustomEvent<PropertyRowsChangeDetail>
  ): void {
    this._props = event.detail.rows;
    this.#flushProperties();
  }

  #flushProperties(): void {
    this.#patch({ properties: propertiesOf(this._props) });
  }

  #patch(
    patch: Partial<VoxelObjectJSON>
  ): void {
    const {
      world,
      layerName,
      objectId
    } = this;
    if (!world || !layerName || !objectId) {
      return;
    }
    if (
      this._object !== null &&
      isNoopPatch(this._object, patch)
    ) {
      return;
    }

    world.updateObjectInLayer(layerName, objectId, patch);
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
