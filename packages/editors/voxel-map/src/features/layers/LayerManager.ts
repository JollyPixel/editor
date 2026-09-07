// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import {
  type JollyRenameDetail,
  type JollyReparentDetail,
  type JollySelectDetail,
  type JollyToggleLockDetail,
  type JollyToggleVisibleDetail,
  type TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  editorState,
  type SelectionStore,
  type WorldStore
} from "../../app/state/index.ts";
import { ViewFocus } from "../../scene/viewFocus.ts";
import { AddLayerDialog } from "./AddLayerDialog.ts";
import {
  createLayerEntry,
  removeLayerEntry,
  renameLayerEntry,
  setLayerEntryLocked,
  setLayerEntryVisibility
} from "./layerActions.ts";
import {
  applyLayerReparent,
  canDropLayerRef
} from "./layerDrop.ts";
import {
  layerRefOf,
  layerRowId,
  layerSelectionOf,
  layerTreeNodes,
  type LayerRef
} from "./layerTree.ts";

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
  declare world: VoxelWorld | undefined;

  @property({ attribute: false })
  declare selection: SelectionStore;

  @property({ attribute: false })
  declare worldStore: WorldStore;

  @property({ attribute: false })
  declare viewFocus: ViewFocus;

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
    this.world = undefined;
    this.selection = editorState.selection;
    this.worldStore = editorState.world;
    this.viewFocus = new ViewFocus();
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

  override willUpdate(
    changedProperties: Map<string | symbol, unknown>
  ): void {
    if (changedProperties.has("world") && this.world) {
      this.#refreshNodes();
    }
  }

  override connectedCallback() {
    super.connectedCallback();

    this.#subscriptions.push(
      this.worldStore.watch("layerUpdated", this.#onLayerUpdated),
      this.worldStore.watch("reset", this.#onLayerUpdated),
      this.selection.watch("change", this.#onSelectionChange)
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
    return html`
      <div class="tree-host" @click=${this.#onHostClick}>
        <jolly-tree
          renamable
          reorderable
          row-drag
          .nodes=${this._nodes}
          .selected=${this._selected}
          .expanded=${this._expanded}
          .acceptDrop=${canDropLayerRef}
          @jolly-select=${this.#onSelect}
          @jolly-toggle-expand=${this.#onToggleExpand}
          @jolly-toggle-visible=${this.#onToggleVisible}
          @jolly-toggle-lock=${this.#onToggleLock}
          @jolly-rename=${this.#onRename}
          @jolly-reparent=${this.#onReparent}
        ></jolly-tree>
      </div>

      <add-layer-dialog></add-layer-dialog>
    `;
  }

  get #selectedRef(): LayerRef | null {
    const [id] = this._selected;

    return id === undefined ? null : layerRefOf(id);
  }

  #selectionFromState(): string[] {
    const current = this.selection.current;

    return current === null ? [] : [layerRowId(current)];
  }

  #expandSelectedLayer(): void {
    const layerName = this.selection.object?.layerName;
    if (layerName === undefined) {
      return;
    }

    const id = layerRowId({
      kind: "object-layer",
      name: layerName
    });
    if (!this._expanded.includes(id)) {
      this._expanded = [...this._expanded, id];
    }
  }

  #refreshNodes(): void {
    if (!this.world) {
      return;
    }

    this._nodes = layerTreeNodes(this.world);
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

    this.selection.clear();
  }

  #onSelect(
    event: CustomEvent<JollySelectDetail>
  ): void {
    this._selected = event.detail.selected;

    const ref = this.#selectedRef;
    this.selection.current = ref === null ? null : layerSelectionOf(ref);
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
    if (!this.world) {
      return;
    }

    const { visible } = event.detail;
    const ref = layerRefOf(event.detail.id);
    setLayerEntryVisibility(
      this.world,
      ref,
      visible
    );
    this.#refreshNodes();
  }

  #onRename(
    event: CustomEvent<JollyRenameDetail>
  ): void {
    const ref = layerRefOf(event.detail.id);
    if (!this.world) {
      return;
    }

    renameLayerEntry(
      this.world,
      ref,
      event.detail.name
    );
    this.#refreshNodes();
  }

  #onToggleLock(
    event: CustomEvent<JollyToggleLockDetail>
  ): void {
    const ref = layerRefOf(event.detail.id);
    if (!this.world) {
      return;
    }

    setLayerEntryLocked(
      this.world,
      ref,
      event.detail.locked
    );
    this.#refreshNodes();
  }

  async addLayer() {
    if (!this.world) {
      return;
    }

    const objectLayer = this.selection.objectLayer;
    const objectLayers = this.world.getObjectLayers();
    const result = await this._addDialog.open({
      canAddObject: objectLayer !== null,
      defaultKind: objectLayer === null ? "voxel-layer" : "object",
      defaultName: {
        "voxel-layer": `Layer ${this.world.getLayers().length + 1}`,
        "object-layer": `Objects ${objectLayers.length + 1}`,
        object: "Object"
      }
    });
    if (result === null) {
      return;
    }

    createLayerEntry(
      this.world,
      this.selection,
      this.viewFocus,
      result
    );
  }

  async removeLayer() {
    const ref = this.#selectedRef;
    if (ref === null || !this.world) {
      return;
    }

    await removeLayerEntry(
      this.world,
      this.selection,
      ref
    );
  }

  #onReparent(
    event: CustomEvent<JollyReparentDetail>
  ): void {
    if (!this.world) {
      return;
    }

    applyLayerReparent(this.world, event.detail);
    this.#refreshNodes();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "layer-manager": LayerManager;
  }
}
