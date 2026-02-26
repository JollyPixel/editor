// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { TreeView } from "@jolly-pixel/fs-tree";
import type {
  VoxelRenderer,
  VoxelLayer,
  VoxelObjectLayerJSON,
  VoxelLayerHookEvent
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../EditorState.ts";
import type { Icon } from "./Icon.ts";

@customElement("layer-manager")
export class LayerManager extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      gap: 4px;
      padding: 4px 8px;
      background: #141a1d;
      border-bottom: 1px solid #2a3540;
    }
    .toolbar button {
      background: #2a3a4a;
      border: 1px solid #3a5060;
      color: #ccc;
      padding: 2px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    .toolbar button:hover {
      background: #3a5a7a;
      color: #fff;
    }

    .tree-host {
      flex: 1;
      overflow-y: auto;
      padding: 4px;
    }
    .tree-host ol {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .tree-host li {
      display: flex;
      align-items: center;
      padding: 3px 6px;
      border-radius: 3px;
      cursor: pointer;
      user-select: none;
      font-size: 12px;
      color: #aaa;
    }
    .tree-host li:hover {
      background: #1e2a30;
      color: #ccc;
    }
    .tree-host li.selected {
      background: #1a3050;
      color: #4488ff;
    }

    .layer-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .gizmo-btn {
      flex-shrink: 0;
      background: transparent;
      border: none;
      color: #728292;
      cursor: pointer;
      font-size: 16px;
      opacity: 1;
      transition: opacity 0.1s, color 0.1s;
      display: flex;
      justify-content: center;
    }
    .gizmo-btn.active {
      opacity: 1;
      color: #29a129;
    }
  `;

  @property({ attribute: false }) declare vr: VoxelRenderer;

  @state() private declare _selectedLayer: string | null;

  constructor() {
    super();
    this._selectedLayer = editorState.selectedLayer;
  }

  #treeView: TreeView | null = null;
  #treeContainer: HTMLDivElement | null = null;

  // voxel layer name → tree LI element
  #itemMap = new Map<string, HTMLLIElement>();
  // object layer name → tree LI element
  #objectItemMap = new Map<string, HTMLLIElement>();

  #onDocumentPointerDown = (e: PointerEvent) => {
    if (!this._selectedLayer || !this.#treeContainer) {
      return;
    }
    const path = e.composedPath();

    // Only deselect when the click is inside the tree-host but not on a layer row.
    if (!path.includes(this.#treeContainer)) {
      return;
    }

    if (path.some((node) => node instanceof HTMLLIElement)) {
      return;
    }
    this.#clearSelection();
  };

  override firstUpdated() {
    this.#treeContainer = this.shadowRoot!.querySelector<HTMLDivElement>(".tree-host")!;

    this.#treeView = new TreeView(this.#treeContainer, {
      multipleSelection: false,
      dropCallback: (_evt, location, nodes) => {
        if (nodes.length === 0 || !this.vr) {
          return false;
        }

        const name = nodes[0].dataset.layerName;
        if (!name) {
          return false;
        }

        // Object layers cannot be reordered via drag-drop in v1.
        if (nodes[0].dataset.layerType === "object") {
          return false;
        }

        // Determine new array index from location and call moveLayer accordingly.
        const allItems = [...this.#itemMap.values()];
        const currentIdx = allItems.indexOf(nodes[0]);
        const targetElt = location.target;
        const targetIdx = targetElt ? allItems.indexOf(targetElt as HTMLLIElement) : allItems.length - 1;

        const delta = targetIdx - currentIdx;
        if (delta === 0) {
          return false;
        }

        const times = Math.abs(delta);
        const direction = delta > 0 ? "down" : "up";
        for (let i = 0; i < times; i++) {
          this.vr.moveLayer(name, direction);
        }

        return true;
      }
    });

    this.#treeView.addEventListener("selectionChange", () => {
      const items = this.#treeContainer!.querySelectorAll<HTMLLIElement>("li.selected");
      const li = items[0] ?? null;
      const name = li?.dataset.layerName ?? null;
      const isObject = li?.dataset.layerType === "object";
      this._selectedLayer = name;
      editorState.setSelectedLayer(name, isObject ? "object" : "voxel");
    });

    this.#populateFromVR();
    this.#listenToVR();

    editorState.addEventListener("gizmoLayerChange", () => {
      this.#updateGizmoButtonStates();
    });

    document.addEventListener("pointerdown", this.#onDocumentPointerDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("pointerdown", this.#onDocumentPointerDown);
  }

  override render() {
    return html`
      <div class="toolbar">
        <button @click=${this.#addLayer}>+ Voxel</button>
        <button @click=${this.#addObjectLayer}>+ Object</button>
        <button @click=${this.#removeLayer} ?disabled=${!this._selectedLayer}>- Remove</button>
        <button @click=${this.#moveUp} ?disabled=${!this._selectedLayer}>↑</button>
        <button @click=${this.#moveDown} ?disabled=${!this._selectedLayer}>↓</button>
      </div>
      <div class="tree-host"></div>
    `;
  }

  #populateFromVR(): void {
    if (!this.vr || !this.#treeView) {
      return;
    }
    this.#treeView.clear();
    this.#itemMap.clear();
    this.#objectItemMap.clear();

    const layers = [...this.vr.world.getLayers()].reverse();
    for (const layer of layers) {
      this.#appendLayerItem(layer);
    }

    for (const objectLayer of this.vr.getObjectLayers()) {
      this.#appendObjectLayerItem(objectLayer);
    }

    // Restore the visual selection highlight after the list is rebuilt.
    if (this._selectedLayer) {
      const li = this.#itemMap.get(this._selectedLayer) ??
        this.#objectItemMap.get(this._selectedLayer);
      if (li) {
        this.#treeView!.selector.add(li);
      }
    }
  }

  #appendLayerItem(
    layer: VoxelLayer
  ): HTMLLIElement {
    const li = document.createElement("li");
    li.dataset.layerName = layer.name;

    const nameSpan = document.createElement("span");
    nameSpan.className = "layer-name";
    nameSpan.textContent = layer.name;

    const gizmoBtn = document.createElement("custom-icon");
    gizmoBtn.className = "gizmo-btn";
    gizmoBtn.title = "Toggle layer gizmo";
    gizmoBtn.setAttribute("name", "transform");
    if (editorState.gizmoLayer === layer.name) {
      gizmoBtn.classList.add("active");
    }
    // Stop propagation so clicking the button doesn't trigger row selection.
    gizmoBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    gizmoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isActive = editorState.gizmoLayer === layer.name;
      editorState.setGizmoLayer(isActive ? null : layer.name);
    });

    li.append(nameSpan, gizmoBtn);
    this.#treeView!.append(li, "item");
    this.#itemMap.set(layer.name, li);

    return li;
  }

  #appendObjectLayerItem(
    layer: VoxelObjectLayerJSON
  ): HTMLLIElement {
    const li = document.createElement("li");
    li.dataset.layerName = layer.name;
    li.dataset.layerType = "object";

    const nameSpan = document.createElement("span");
    nameSpan.className = "layer-name";
    nameSpan.textContent = `[Obj] ${layer.name}`;

    li.append(nameSpan);
    this.#treeView!.append(li, "item");
    this.#objectItemMap.set(layer.name, li);

    return li;
  }

  #clearSelection(): void {
    this.#treeView?.selector.clear();
    this._selectedLayer = null;
    editorState.setSelectedLayer(null);
  }

  #updateGizmoButtonStates(): void {
    const active = editorState.gizmoLayer;
    for (const [name, li] of this.#itemMap) {
      const btn = li.querySelector<Icon>(".gizmo-btn");
      if (btn) {
        btn.classList.toggle("active", name === active);
      }
    }
    // Object layers have no gizmo button; no action needed for #objectItemMap.
  }

  #listenToVR(): void {
    // Layer events are broadcast via editorState by index.ts wiring.
    editorState.addEventListener("layerUpdated", (event) => {
      const evt = (event as CustomEvent<VoxelLayerHookEvent>).detail;
      if (evt.action === "added") {
        const layer = this.vr?.getLayer(evt.layerName);
        if (layer) {
          this.#appendLayerItem(layer);
        }
      }
      else if (evt.action === "removed") {
        const li = this.#itemMap.get(evt.layerName);
        if (li) {
          this.#treeView!.remove(li);
          this.#itemMap.delete(evt.layerName);
        }
      }
      else if (evt.action === "reordered") {
        this.#populateFromVR();
      }
      else if (evt.action === "object-layer-added") {
        const objectLayer = this.vr?.getObjectLayer(evt.layerName);
        if (objectLayer) {
          this.#appendObjectLayerItem(objectLayer);
        }
      }
      else if (evt.action === "object-layer-removed") {
        const li = this.#objectItemMap.get(evt.layerName);
        if (li) {
          this.#treeView!.remove(li);
          this.#objectItemMap.delete(evt.layerName);
        }
      }
    });
  }

  #addLayer(): void {
    if (!this.vr) {
      return;
    }

    // eslint-disable-next-line no-alert
    const name = prompt("Layer name:", `Layer ${this.vr.world.getLayers().length + 1}`);
    if (!name?.trim()) {
      return;
    }
    this.vr.addLayer(name.trim());
  }

  #addObjectLayer(): void {
    if (!this.vr) {
      return;
    }

    // eslint-disable-next-line no-alert
    const name = prompt("Object layer name:", `Objects ${this.vr.getObjectLayers().length + 1}`);
    if (!name?.trim()) {
      return;
    }
    this.vr.addObjectLayer(name.trim());
  }

  #removeLayer(): void {
    if (!this._selectedLayer || !this.vr) {
      return;
    }

    if (this.#objectItemMap.has(this._selectedLayer)) {
      this.vr.removeObjectLayer(this._selectedLayer);
    }
    else {
      this.vr.removeLayer(this._selectedLayer);
      this.vr.markAllChunksDirty();
    }
    this._selectedLayer = null;
    editorState.setSelectedLayer(null);
  }

  #moveUp(): void {
    if (!this._selectedLayer || !this.vr || this.#objectItemMap.has(this._selectedLayer)) {
      return;
    }

    this.vr.moveLayer(this._selectedLayer, "up");
  }

  #moveDown(): void {
    if (!this._selectedLayer || !this.vr || this.#objectItemMap.has(this._selectedLayer)) {
      return;
    }

    this.vr.moveLayer(this._selectedLayer, "down");
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "layer-manager": LayerManager;
  }
}
