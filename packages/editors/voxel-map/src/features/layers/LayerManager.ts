// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import type { VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import {
  showConfirm,
  type JollyRenameDetail,
  type JollySelectDetail,
  type JollyToggleLockDetail,
  type JollyToggleVisibleDetail,
  type TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  editorState,
  type LayerSelection
} from "../../EditorState.ts";
import { createObjectAt } from "../object-layers/objectArea.ts";
// Imported for its side effect too: it registers the child dialog element.
import { AddLayerDialog } from "./AddLayerDialog.ts";

// CONSTANTS
const kVoxelPrefix = "voxel:";
const kObjectLayerPrefix = "object:";
const kObjectPrefix = "obj:";

/** Tree-row identity encoded in the row id. */
type LayerRef =
  | { kind: "voxel-layer"; name: string; }
  | { kind: "object-layer"; name: string; }
  | { kind: "object"; layerName: string; objectId: string; };

function rowId(
  ref: LayerRef
): string {
  switch (ref.kind) {
    case "voxel-layer":
      return `${kVoxelPrefix}${ref.name}`;
    case "object-layer":
      return `${kObjectLayerPrefix}${ref.name}`;
    default:
      return `${kObjectPrefix}${ref.layerName}/${ref.objectId}`;
  }
}

function refOf(
  id: string
): LayerRef {
  if (id.startsWith(kObjectPrefix)) {
    const rest = id.slice(kObjectPrefix.length);
    const separator = rest.lastIndexOf("/");

    return {
      kind: "object",
      layerName: rest.slice(0, separator),
      objectId: rest.slice(separator + 1)
    };
  }

  return id.startsWith(kObjectLayerPrefix)
    ? { kind: "object-layer", name: id.slice(kObjectLayerPrefix.length) }
    : { kind: "voxel-layer", name: id.slice(kVoxelPrefix.length) };
}

function selectionOf(
  ref: LayerRef
): LayerSelection {
  return ref.kind === "object"
    ? {
      kind: "object",
      layerName: ref.layerName,
      objectId: ref.objectId
    }
    : { kind: ref.kind, name: ref.name };
}

@customElement("layer-manager")
export class LayerManager extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      overflow: hidden;
    }

    .tree-host {
      flex: 1;
      overflow-y: auto;
    }
  `;

  @property({ attribute: false })
  declare vr: VoxelRenderer;

  @state()
  private declare _nodes: TreeNode<LayerRef>[];
  @state()
  private declare _selected: string[];
  @state()
  private declare _expanded: string[];

  @query("add-layer-dialog")
  private declare _addDialog: AddLayerDialog;

  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this._nodes = [];
    this._selected = [];
    this._expanded = [];
  }

  readonly #onLayerUpdated = () => {
    this.#refreshNodes();
  };

  readonly #onSelectionChange = () => {
    this._selected = this.#selectionFromState();
    this.#expandSelectedLayer();
  };

  override updated(
    changedProperties: Map<string | symbol, unknown>
  ): void {
    if (changedProperties.has("vr") && this.vr) {
      this.#refreshNodes();
    }
  }

  override connectedCallback() {
    super.connectedCallback();

    this.#subscriptions.push(
      editorState.on("layerUpdated", this.#onLayerUpdated),
      editorState.on("worldReset", this.#onLayerUpdated),
      editorState.on("selectionChange", this.#onSelectionChange)
    );

    this._selected = this.#selectionFromState();
    this.#refreshNodes();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  override render() {
    const hasSelection = this._selected.length > 0;

    return html`
      <jolly-toolbar label="Layers">
        <jolly-button @click=${this.#add}>+ Add</jolly-button>
        <jolly-button
          @click=${this.#remove}
          ?disabled=${!hasSelection}
        >- Remove</jolly-button>
        <jolly-button
          @click=${this.#moveUp}
          ?disabled=${!this.#canMove}
        >↑</jolly-button>
        <jolly-button
          @click=${this.#moveDown}
          ?disabled=${!this.#canMove}
        >↓</jolly-button>
      </jolly-toolbar>

      <div class="tree-host" @click=${this.#onHostClick}>
        <jolly-tree
          renamable
          .nodes=${this._nodes}
          .selected=${this._selected}
          .expanded=${this._expanded}
          @jolly-select=${this.#onSelect}
          @jolly-toggle-expand=${this.#onToggleExpand}
          @jolly-toggle-visible=${this.#onToggleVisible}
          @jolly-toggle-lock=${this.#onToggleLock}
          @jolly-rename=${this.#onRename}
        ></jolly-tree>
      </div>

      <add-layer-dialog></add-layer-dialog>
    `;
  }

  get #selectedRef(): LayerRef | null {
    const [id] = this._selected;

    return id === undefined ? null : refOf(id);
  }

  get #canMove(): boolean {
    return this.#selectedRef?.kind === "voxel-layer";
  }

  #selectionFromState(): string[] {
    const { selection } = editorState;

    return selection === null ? [] : [rowId(selection)];
  }

  #expandSelectedLayer(): void {
    const layerName = editorState.selectedObject?.layerName;
    if (layerName === undefined) {
      return;
    }

    const id = rowId({ kind: "object-layer", name: layerName });
    if (!this._expanded.includes(id)) {
      this._expanded = [...this._expanded, id];
    }
  }

  #refreshNodes(): void {
    if (!this.vr) {
      return;
    }

    const layers = [
      ...this.vr.engine.world.getLayers()
    ].reverse();

    this._nodes = [
      ...layers.map((layer): TreeNode<LayerRef> => {
        const ref: LayerRef = { kind: "voxel-layer", name: layer.name };

        return {
          id: rowId(ref),
          label: layer.name,
          icon: "voxel-layer",
          visible: layer.visible,
          data: ref
        };
      }),
      ...this.vr.engine.world.getObjectLayers().map((layer): TreeNode<LayerRef> => {
        const ref: LayerRef = { kind: "object-layer", name: layer.name };

        return {
          id: rowId(ref),
          label: layer.name,
          icon: "object-layer",
          visible: layer.visible,
          data: ref,
          children: layer.objects.map((object): TreeNode<LayerRef> => {
            const objectRef: LayerRef = {
              kind: "object",
              layerName: layer.name,
              objectId: object.id
            };

            return {
              id: rowId(objectRef),
              label: object.name,
              icon: "object-area",
              visible: object.visible,
              locked: object.locked ?? false,
              // Layer names are persistent keys and cannot be renamed here.
              renamable: true,
              data: objectRef
            };
          })
        };
      })
    ];
  }

  #onHostClick(
    event: MouseEvent
  ): void {
    const onRow = event.composedPath().some(
      (node) => node instanceof HTMLElement && node.classList.contains("row")
    );
    if (onRow) {
      return;
    }

    editorState.setSelection(null);
  }

  #onSelect(
    event: CustomEvent<JollySelectDetail>
  ): void {
    this._selected = event.detail.selected;

    const ref = this.#selectedRef;
    editorState.setSelection(ref === null ? null : selectionOf(ref));
  }

  #onToggleExpand(
    event: CustomEvent<{ id: string; expanded: boolean; }>
  ): void {
    const { id, expanded } = event.detail;
    this._expanded = expanded
      ? [...this._expanded, id]
      : this._expanded.filter((candidate) => candidate !== id);
  }

  #onToggleVisible(
    event: CustomEvent<JollyToggleVisibleDetail>
  ): void {
    if (!this.vr) {
      return;
    }

    const { visible } = event.detail;
    const ref = refOf(event.detail.id);
    switch (ref.kind) {
      case "object":
        this.vr.engine.world.updateObjectInLayer(ref.layerName, ref.objectId, { visible });
        break;
      case "object-layer":
        this.vr.engine.world.updateObjectLayer(ref.name, { visible });
        break;
      default:
        this.vr.engine.world.updateLayer(ref.name, { visible });
        break;
    }
    this.#refreshNodes();
  }

  #onRename(
    event: CustomEvent<JollyRenameDetail>
  ): void {
    const ref = refOf(event.detail.id);
    if (!this.vr || ref.kind !== "object") {
      return;
    }

    this.vr.engine.world.updateObjectInLayer(
      ref.layerName,
      ref.objectId,
      { name: event.detail.name }
    );
    this.#refreshNodes();
  }

  #onToggleLock(
    event: CustomEvent<JollyToggleLockDetail>
  ): void {
    const ref = refOf(event.detail.id);
    if (!this.vr || ref.kind !== "object") {
      return;
    }

    this.vr.engine.world.updateObjectInLayer(
      ref.layerName,
      ref.objectId,
      { locked: event.detail.locked }
    );
    this.#refreshNodes();
  }

  async #add() {
    if (!this.vr) {
      return;
    }

    const { activeObjectLayer } = editorState;
    const objectLayers = this.vr.engine.world.getObjectLayers();
    const result = await this._addDialog.open({
      canAddObject: activeObjectLayer !== null,
      defaultKind: activeObjectLayer === null ? "voxel-layer" : "object",
      defaultName: {
        "voxel-layer": `Layer ${this.vr.engine.world.getLayers().length + 1}`,
        "object-layer": `Objects ${objectLayers.length + 1}`,
        object: "Object"
      }
    });
    if (result === null) {
      return;
    }

    switch (result.kind) {
      case "voxel-layer":
        this.vr.engine.world.addLayer(result.name);
        editorState.selectVoxelLayer(result.name);
        break;
      case "object-layer":
        this.vr.engine.world.addObjectLayer(result.name);
        editorState.selectObjectLayer(result.name);
        break;
      default:
        this.#addObject(activeObjectLayer!, result.name);
        break;
    }
  }

  #addObject(
    layerName: string,
    name: string
  ): void {
    // Spawn new objects in the camera's focus cell.
    const object = createObjectAt(name, editorState.viewFocus);
    this.vr.engine.world.addObjectToLayer(layerName, object);
    editorState.selectObject({ layerName, objectId: object.id });
  }

  async #remove() {
    const ref = this.#selectedRef;
    if (ref === null || !this.vr) {
      return;
    }

    if (ref.kind === "object") {
      this.vr.engine.world.removeObjectFromLayer(ref.layerName, ref.objectId);
      editorState.selectObjectLayer(ref.layerName);

      return;
    }

    // Layer deletion is irreversible without an undo stack.
    const confirmed = await showConfirm({
      title: "Delete layer",
      message: this.#removalMessage(ref),
      confirmLabel: "Delete",
      danger: true
    });
    if (!confirmed) {
      return;
    }

    if (ref.kind === "object-layer") {
      this.vr.engine.world.removeObjectLayer(ref.name);
    }
    else {
      this.vr.engine.world.removeLayer(ref.name);
    }
    editorState.setSelection(null);
  }

  #removalMessage(
    ref: LayerRef & { name: string; }
  ): string {
    if (ref.kind !== "object-layer") {
      return `Delete the voxel layer "${ref.name}" and everything painted on it?`;
    }

    const count = this.vr.engine.world.getObjectLayer(ref.name)?.objects.length ?? 0;

    return count === 0
      ? `Delete the object layer "${ref.name}"?`
      : `Delete the object layer "${ref.name}" and its ${count} object(s)?`;
  }

  #moveUp(): void {
    this.#move("up");
  }

  #moveDown(): void {
    this.#move("down");
  }

  #move(
    direction: "up" | "down"
  ): void {
    const ref = this.#selectedRef;
    if (
      ref === null ||
      ref.kind !== "voxel-layer" ||
      !this.vr
    ) {
      return;
    }

    this.vr.engine.world.moveLayer(ref.name, direction);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "layer-manager": LayerManager;
  }
}
