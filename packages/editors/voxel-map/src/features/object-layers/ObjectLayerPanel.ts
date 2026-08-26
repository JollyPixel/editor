// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import type {
  VoxelRenderer,
  VoxelObjectLayerJSON,
  VoxelObjectJSON,
  VoxelLayerHookEvent
} from "@jolly-pixel/voxel.renderer";
import {
  showPrompt,
  type JollyChangeDetail,
  type Vec3Like
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { editorState } from "../../EditorState.ts";
import { normalizeVoxelExtent } from "../../shared/voxelExtent.ts";
import type { Vec2Like } from "../../shared/dom.types.ts";

@customElement("object-layer-panel")
export class ObjectLayerPanel extends LitElement {
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
  private declare _layer: VoxelObjectLayerJSON | null;
  @state()
  private declare _objects: VoxelObjectJSON[];
  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this.layerName = null;
    this._layer = null;
    this._objects = [];
  }

  #onLayerUpdated = (evt: VoxelLayerHookEvent) => {
    if (
      evt.layerName !== this.layerName ||
      (
        evt.action !== "object-layer-updated" &&
        evt.action !== "object-added" &&
        evt.action !== "object-removed" &&
        evt.action !== "object-updated"
      )
    ) {
      return;
    }
    this.#syncFromLayer();
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

    const layer = this.vr.engine.getObjectLayer(this.layerName) ?? null;
    this._layer = layer;

    if (layer) {
      this._objects = [...layer.objects];
    }
  }

  override render() {
    if (!this._layer) {
      return nothing;
    }

    return html`
      <div class="panel-title">Object Layer: ${this.layerName}</div>

      ${repeat(
        this._objects,
        (object) => object.id,
        (object) => this.#renderObject(object)
      )}

      <jolly-button @click=${this.#addObject}>+ Add Object</jolly-button>
    `;
  }

  #renderObject(
    obj: VoxelObjectJSON
  ) {
    return html`
      <jolly-folder
        key=${obj.id}
        label=${obj.name}
      >
        <jolly-text
          label="Name"
          .value=${obj.name}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => this.#onObjectNameChange(obj.id, event)}
        ></jolly-text>

        ${obj.type
          ? html`<jolly-property-row label="Type">${obj.type}</jolly-property-row>`
          : nothing}

        <jolly-checkbox
          align="end"
          label="Visible"
          .value=${obj.visible}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<boolean>>) => this.#onObjectVisibleChange(obj.id, event)}
        ></jolly-checkbox>

        <jolly-vector3
          label="Position"
          step="1"
          .value=${{ x: obj.x, y: obj.y, z: obj.z }}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<Vec3Like>>) => this.#onObjectPosChange(obj.id, event)}
        ></jolly-vector3>

        <jolly-vector2
          label="Size"
          step="1"
          min="1"
          .axisLabels=${{ x: "W", y: "H" }}
          .value=${{
            x: normalizeVoxelExtent(obj.width ?? 1),
            y: normalizeVoxelExtent(obj.height ?? 1)
          }}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<Vec2Like>>) => this.#onObjectSizeChange(obj.id, event)}
        ></jolly-vector2>

        ${this.#renderObjectProperties(obj)}

        <jolly-button
          variant="danger"
          @click=${() => this.#removeObject(obj.id)}
        >Remove object</jolly-button>
      </jolly-folder>
    `;
  }

  #renderObjectProperties(
    obj: VoxelObjectJSON
  ) {
    const entries = Object.entries(obj.properties ?? {});

    return html`
      <jolly-folder key="properties" label="Properties">
        ${entries.map(([key, value]) => html`
          <div class="prop-row">
            <jolly-text
              placeholder="key"
              .value=${key}
              @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => this.#onPropKeyChange(obj.id, key, event)}
            ></jolly-text>
            <jolly-text
              placeholder="value"
              .value=${String(value)}
              @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => this.#onPropValueChange(obj.id, key, event)}
            ></jolly-text>
            <jolly-button
              icon="close"
              icon-only
              variant="danger"
              label="Remove property"
              @click=${() => this.#removeProp(obj.id, key)}
            ></jolly-button>
          </div>
        `)}
        <jolly-button @click=${() => this.#addProp(obj.id)}>+ Add property</jolly-button>
      </jolly-folder>
    `;
  }

  #onObjectNameChange(
    objId: string,
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    const name = event.detail.value.trim();
    if (!this.layerName || !name) {
      return;
    }

    this.vr.engine.updateObject(this.layerName, objId, { name });
  }

  #onObjectVisibleChange(
    objId: string,
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    if (!this.layerName) {
      return;
    }

    this.vr.engine.updateObject(
      this.layerName,
      objId,
      { visible: event.detail.value }
    );
  }

  #onObjectPosChange(
    objId: string,
    event: CustomEvent<JollyChangeDetail<Vec3Like>>
  ): void {
    if (!this.layerName) {
      return;
    }

    const { x, y, z } = event.detail.value;
    this.vr.engine.updateObject(
      this.layerName,
      objId,
      {
        x: Math.round(x),
        y: Math.round(y),
        z: Math.round(z)
      }
    );
  }

  #onObjectSizeChange(
    objId: string,
    event: CustomEvent<JollyChangeDetail<Vec2Like>>
  ): void {
    if (!this.layerName) {
      return;
    }

    const { x: width, y: height } = event.detail.value;
    this.vr.engine.updateObject(
      this.layerName,
      objId,
      {
        width: normalizeVoxelExtent(width),
        height: normalizeVoxelExtent(height)
      }
    );
  }

  #onPropKeyChange(
    objId: string,
    oldKey: string,
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    const obj = this.#objectById(objId);
    if (obj === undefined) {
      return;
    }

    const newKey = event.detail.value.trim();
    if (!newKey || newKey === oldKey) {
      return;
    }

    const props = { ...(obj.properties ?? {}) };
    props[newKey] = props[oldKey];
    delete props[oldKey];
    this.vr.engine.updateObject(
      this.layerName!,
      objId,
      { properties: props }
    );
  }

  #onPropValueChange(
    objId: string,
    key: string,
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    const obj = this.#objectById(objId);
    if (obj === undefined) {
      return;
    }

    const props = { ...(obj.properties ?? {}), [key]: event.detail.value };
    this.vr.engine.updateObject(
      this.layerName!,
      objId,
      { properties: props }
    );
  }

  #addProp(
    objId: string
  ): void {
    const obj = this.#objectById(objId);
    if (obj === undefined) {
      return;
    }

    const props = { ...(obj.properties ?? {}), "": "" };
    this.vr.engine.updateObject(
      this.layerName!,
      objId,
      { properties: props }
    );
  }

  #removeProp(
    objId: string,
    key: string
  ): void {
    const obj = this.#objectById(objId);
    if (obj === undefined) {
      return;
    }

    const props = { ...(obj.properties ?? {}) };
    delete props[key];
    this.vr.engine.updateObject(
      this.layerName!,
      objId,
      { properties: props }
    );
  }

  #objectById(
    objId: string
  ): VoxelObjectJSON | undefined {
    if (!this.layerName) {
      return undefined;
    }

    return this._objects.find((candidate) => candidate.id === objId);
  }

  #removeObject(
    objId: string
  ): void {
    if (!this.layerName) {
      return;
    }

    this.vr.engine.removeObject(this.layerName, objId);
  }

  async #addObject() {
    if (!this.layerName) {
      return;
    }

    const name = await showPrompt({
      title: "New object",
      label: "Object name:",
      defaultValue: "Object"
    });
    if (!name?.trim()) {
      return;
    }

    this.vr.engine.addObject(this.layerName, {
      id: crypto.randomUUID(),
      name: name.trim(),
      x: 0,
      y: 0,
      z: 0,
      visible: true
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "object-layer-panel": ObjectLayerPanel;
  }
}
