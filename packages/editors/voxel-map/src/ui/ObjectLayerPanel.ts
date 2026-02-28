// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type {
  VoxelRenderer,
  VoxelObjectLayerJSON,
  VoxelObjectJSON,
  VoxelLayerHookEvent
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../EditorState.ts";
import type { EventInput } from "./types.ts";
import type { Vec3 } from "./Vec3Input.ts";
import type { Vec2 } from "./Vec2Input.ts";
import { showPrompt } from "./PromptDialog.ts";

@customElement("object-layer-panel")
export class ObjectLayerPanel extends LitElement {
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
    input[type="number"],
    input[type="text"] {
      background: #111a20;
      border: 1px solid #333;
      color: #eee;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 12px;
      width: 56px;
    }
    input[type="text"] {
      width: auto;
      flex: 1;
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 10px 0 5px;
    }
    .object-card {
      background: #111a20;
      border: 1px solid #2a3540;
      border-radius: 4px;
      padding: 6px;
      margin-bottom: 6px;
    }
    .object-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .object-name {
      flex: 1;
      font-weight: 600;
      font-size: 12px;
    }
    .object-type {
      font-size: 11px;
      color: #778899;
    }
    .remove-btn {
      background: transparent;
      border: none;
      color: #ff5555;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0 2px;
    }
    vec3-input,
    vec2-input {
      margin-bottom: 4px;
    }
    .prop-row {
      display: flex;
      gap: 4px;
      margin-bottom: 4px;
    }
    .prop-row input[type="text"] {
      flex: 1;
    }
    .prop-remove {
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

  @state() private declare _layer: VoxelObjectLayerJSON | null;
  @state() private declare _visible: boolean;
  @state() private declare _objects: VoxelObjectJSON[];

  constructor() {
    super();
    this.layerName = null;
    this._layer = null;
    this._visible = true;
    this._objects = [];
  }

  #onLayerUpdated = (event: Event) => {
    const evt = (event as CustomEvent<VoxelLayerHookEvent>).detail;
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

    const layer = this.vr.getObjectLayer(this.layerName) ?? null;
    this._layer = layer;

    if (layer) {
      this._visible = layer.visible;
      this._objects = [...layer.objects];
    }
  }

  override render() {
    if (!this._layer) {
      return nothing;
    }

    return html`
      <div class="panel-title">Object Layer: ${this.layerName}</div>

      <div class="row">
        <label>Visible</label>
        <input
          type="checkbox"
          ?checked=${this._visible}
          @change=${this.#onVisibleChange}
        />
      </div>

      <div class="section-title">Objects</div>
      ${this._objects.map((obj) => this.#renderObject(obj))}

      <button class="add-btn" @click=${this.#addObject}>+ Add Object</button>
    `;
  }

  #renderObject(
    obj: VoxelObjectJSON
  ) {
    return html`
      <div class="object-card">
        <div class="object-header">
          <span class="object-name">${obj.name}</span>
          ${obj.type ? html`<span class="object-type">${obj.type}</span>` : null}
          <input
            type="checkbox"
            title="Visible"
            ?checked=${obj.visible}
            @change=${(e: EventInput) => this.#onObjectVisibleChange(obj.id, e)}
          />
          <button class="remove-btn" @click=${() => this.#removeObject(obj.id)}>×</button>
        </div>

        <vec3-input
          .x=${obj.x}
          .y=${obj.y}
          .z=${obj.z}
          @change=${(e: CustomEvent<Vec3>) => this.#onObjectPosChange(obj.id, e)}
        ></vec3-input>

        <vec2-input
          .x=${obj.width ?? 1}
          .y=${obj.height ?? 1}
          labelX="W"
          labelY="H"
          @change=${(e: CustomEvent<Vec2>) => this.#onObjectSizeChange(obj.id, e)}
        ></vec2-input>

        ${this.#renderObjectProperties(obj)}
      </div>
    `;
  }

  #renderObjectProperties(
    obj: VoxelObjectJSON
  ) {
    const props = obj.properties ?? {};
    const entries = Object.entries(props);

    return html`
      <div class="section-title" style="margin-top:6px;">Properties</div>
      ${entries.map(([key, value]) => html`
        <div class="prop-row">
          <input
            type="text"
            placeholder="key"
            .value=${key}
            @change=${(e: EventInput) => this.#onPropKeyChange(obj.id, key, e)}
          />
          <input
            type="text"
            placeholder="value"
            .value=${String(value)}
            @change=${(e: EventInput) => this.#onPropValueChange(obj.id, key, e)}
          />
          <button class="prop-remove" @click=${() => this.#removeProp(obj.id, key)}>×</button>
        </div>
      `)}
      <button
        class="add-btn"
        @click=${() => this.#addProp(obj.id)}
      >+ Add property</button>
    `;
  }

  #onVisibleChange(
    event: EventInput
  ): void {
    if (!this.layerName) {
      return;
    }

    this._visible = event.target.checked;
    this.vr.updateObjectLayer(this.layerName, { visible: this._visible });
  }

  #onObjectVisibleChange(
    objId: string,
    event: EventInput
  ): void {
    if (!this.layerName) {
      return;
    }

    this.vr.updateObject(this.layerName, objId, { visible: event.target.checked });
  }

  #onObjectPosChange(
    objId: string,
    event: CustomEvent<Vec3>
  ): void {
    if (!this.layerName) {
      return;
    }

    const { x, y, z } = event.detail;
    this.vr.updateObject(this.layerName, objId, { x, y, z });
  }

  #onObjectSizeChange(
    objId: string,
    event: CustomEvent<Vec2>
  ): void {
    if (!this.layerName) {
      return;
    }

    const { x: width, y: height } = event.detail;
    this.vr.updateObject(this.layerName, objId, { width, height });
  }

  #onPropKeyChange(
    objId: string,
    oldKey: string,
    event: EventInput
  ): void {
    if (!this.layerName) {
      return;
    }

    const obj = this._objects.find((o) => o.id === objId);
    if (!obj) {
      return;
    }

    const newKey = event.target.value.trim();
    if (!newKey || newKey === oldKey) {
      return;
    }

    const props = { ...(obj.properties ?? {}) };
    props[newKey] = props[oldKey];
    delete props[oldKey];
    this.vr.updateObject(this.layerName, objId, { properties: props });
  }

  #onPropValueChange(
    objId: string,
    key: string,
    event: EventInput
  ): void {
    if (!this.layerName) {
      return;
    }

    const obj = this._objects.find((o) => o.id === objId);
    if (!obj) {
      return;
    }

    const props = { ...(obj.properties ?? {}), [key]: event.target.value };
    this.vr.updateObject(this.layerName, objId, { properties: props });
  }

  #addProp(
    objId: string
  ): void {
    if (!this.layerName) {
      return;
    }

    const obj = this._objects.find((o) => o.id === objId);
    if (!obj) {
      return;
    }

    const props = { ...(obj.properties ?? {}), "": "" };
    this.vr.updateObject(this.layerName, objId, { properties: props });
  }

  #removeProp(
    objId: string,
    key: string
  ): void {
    if (!this.layerName) {
      return;
    }

    const obj = this._objects.find((o) => o.id === objId);
    if (!obj) {
      return;
    }

    const props = { ...(obj.properties ?? {}) };
    delete props[key];
    this.vr.updateObject(this.layerName, objId, { properties: props });
  }

  #removeObject(
    objId: string
  ): void {
    if (!this.layerName) {
      return;
    }

    this.vr.removeObject(this.layerName, objId);
  }

  async #addObject() {
    if (!this.layerName) {
      return;
    }

    const name = await showPrompt({ label: "Object name:", defaultValue: "Object" });
    if (!name?.trim()) {
      return;
    }

    this.vr.addObject(this.layerName, {
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
