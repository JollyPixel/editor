// Import Third-party Dependencies
import { html, nothing } from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import {
  ContextMenuController,
  MenuSession,
  formatCount,
  type ContextMenu,
  type JollyRenameDetail,
  type JollyReparentDetail,
  type JollySelectDetail,
  type JollyToggleLockDetail,
  type JollyToggleVisibleDetail,
  type Tree,
  type TreeDragOut,
  type TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  parseLayerRef,
  type LayerRef
} from "../../state/index.ts";
import type { VoxelMapEditing } from "../../editing/VoxelMapEditing.ts";
import { EditingElement } from "../../editing/EditingElement.ts";
import { AddLayerDialog } from "./dialogs/AddLayerDialog.ts";
import { layerManagerStyles } from "./LayerManager.styles.ts";
import { LayerCommands } from "./LayerCommands.ts";
import { LayerMenu } from "./LayerMenu.ts";
import { MapLayers } from "./MapLayers.ts";
import {
  layerTreeNodes,
  withLayerBadges
} from "./layerTree.ts";
import "./objects/ObjectPanel.ts";
import "./voxel/VoxelLayerPanel.ts";
import "./layerIcons.ts";

@customElement("layer-manager")
export class LayerManager extends EditingElement {
  static override styles = layerManagerStyles;

  @property({ attribute: false })
  declare dragOut: TreeDragOut | null;

  @state()
  private declare _nodes: TreeNode<LayerRef>[];

  @state()
  private declare _selection: LayerRef | null;

  @state()
  private declare _expanded: string[];

  @query("jolly-folder")
  private declare _folder: HTMLElementTagNameMap["jolly-folder"] | null;

  @query("add-layer-dialog")
  private declare _addDialog: AddLayerDialog;

  @query("jolly-tree")
  private declare _tree: Tree<LayerRef> | null;

  @query("jolly-context-menu")
  private declare _contextMenu: ContextMenu;

  #menu = new ContextMenuController(
    () => this._contextMenu,
    (id) => this.#openMenu(id)
  );

  constructor() {
    super();
    this.dragOut = null;
    this._nodes = [];
    this._selection = null;
    this._expanded = [];
  }

  protected override watchEditing(
    editing: VoxelMapEditing
  ): Iterable<() => void> {
    const { selection, presence } = editing.state;
    const refresh = (): void => this.#refreshNodes(editing);
    this._selection = selection.current;
    refresh();

    return [
      editing.editorMap.subscribe("layerUpdated", refresh),
      editing.editorMap.subscribe("reset", refresh),
      presence.subscribe("layerSelectionsChange", refresh),
      editing.layerVisibility.subscribe("change", refresh),
      editing.access.subscribe("change", refresh),
      editing.usage.subscribe("change", () => this.requestUpdate()),
      editing.state.editContext.subscribe(
        "change",
        () => this.requestUpdate()
      ),
      selection.subscribe("change", (current) => {
        this._selection = current;
        this.#expandSelectedLayer(current);
      })
    ];
  }

  override render() {
    const editing = this.editing;
    if (editing === null) {
      return nothing;
    }

    if (editing.state.editContext.draft !== null) {
      return html`
        <jolly-folder
          key="layers"
          label="Layers"
          storage-key="voxel-map:folder:layers"
        >
          <p class="hint">
            Map layers are hidden while you edit a template. Press Done in the
            viewport to go back to the map.
          </p>
        </jolly-folder>
      `;
    }

    const { layers } = editing;
    const selection = this._selection;
    const voxelLayerSelected = selection?.kind === "voxel-layer" &&
      layers.canEdit(selection.kind);
    const removable = selection !== null && layers.canEdit(selection.kind);

    return html`
      <jolly-folder
        key="layers"
        label="Layers"
        storage-key="voxel-map:folder:layers"
      >
        <span
          slot="actions"
          class="total"
          title="Voxels placed in the map"
        >${formatCount(editing.usage.stats.voxels, "voxel")}</span>
        <jolly-button
          slot="actions"
          icon="plus"
          icon-only
          label="Add layer"
          title="Add layer"
          ?disabled=${!layers.canEdit("voxel-layer")}
          @click=${this.#addLayer}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="copy"
          icon-only
          label="Clone layer"
          title="Clone layer"
          ?disabled=${!voxelLayerSelected}
          @click=${this.#cloneLayer}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="trash"
          icon-only
          variant="danger"
          label="Remove layer"
          title="Remove layer"
          ?disabled=${!removable}
          @click=${this.#removeLayer}
        ></jolly-button>

        <div class="tree-host">
          <jolly-tree
            require-selection
            .renamable=${layers.canEdit("object")}
            .reorderable=${layers.canEdit("voxel-layer")}
            .rowDrag=${layers.canEdit("voxel-layer")}
            .nodes=${this._nodes}
            .selected=${this._selection === null ? [] : [this._selection.key]}
            .expanded=${this._expanded}
            .acceptDrop=${MapLayers.acceptsDrop}
            .dragOut=${this.dragOut}
            @jolly-context-request=${this.#menu.onContextRequest}
            @jolly-select=${this.#onSelect}
            @jolly-toggle-expand=${this.#onToggleExpand}
            @jolly-toggle-visible=${this.#onToggleVisible}
            @jolly-toggle-lock=${this.#onToggleLock}
            @jolly-rename=${this.#onRename}
            @jolly-reparent=${this.#onReparent}
          ></jolly-tree>
        </div>
        ${this.#renderInspector(editing)}
      </jolly-folder>

      <add-layer-dialog></add-layer-dialog>
      <jolly-context-menu
        label="Layer actions"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
    `;
  }

  #openMenu(
    id: string | null
  ): MenuSession {
    const editing = this.editing;
    if (editing === null) {
      return MenuSession.EMPTY;
    }

    const menu = new LayerMenu({
      world: editing.editorMap.world,
      layers: editing.layers,
      templatesEditable: editing.templates.editable,
      commands: new LayerCommands({
        editing,
        rename: (ref) => this._tree?.beginRename(ref.key),
        addLayer: this.#addLayer
      })
    });

    return id === null ? menu.rootSession() : menu.session(parseLayerRef(id));
  }

  #renderInspector(
    editing: VoxelMapEditing
  ) {
    const { world } = editing.editorMap;
    const selection = this._selection;
    if (selection === null) {
      return nothing;
    }
    const writable = editing.layers.canEdit(selection.kind);

    switch (selection.kind) {
      case "voxel-layer":
        return html`<layer-panel
          .world=${world}
          .selection=${editing.state.selection}
          .placement=${editing.placement}
          .editorMap=${editing.editorMap}
          .layerName=${selection.name}
          .writable=${writable}
        ></layer-panel>`;
      case "object":
        return html`<object-panel
          .world=${world}
          .editorMap=${editing.editorMap}
          .layerName=${selection.layerName}
          .objectId=${selection.objectId}
          .writable=${writable}
        ></object-panel>`;
      default:
        return html`<p class="hint">
          Select an object to edit its properties.
        </p>`;
    }
  }

  #refreshNodes(
    editing: VoxelMapEditing
  ): void {
    this._nodes = withLayerBadges(
      layerTreeNodes(
        editing.editorMap.world,
        editing.layerVisibility,
        editing.layers
      ),
      editing.state.presence.layerSelections
    );
  }

  #expandSelectedLayer(
    selection: LayerRef | null
  ): void {
    if (selection?.kind !== "object") {
      return;
    }

    const id = selection.layer.key;
    if (!this._expanded.includes(id)) {
      this._expanded = [...this._expanded, id];
    }
  }

  #onSelect(
    event: CustomEvent<JollySelectDetail>
  ): void {
    const [id] = event.detail.selected;
    if (id !== undefined && this.editing !== null) {
      this.editing.state.selection.current = parseLayerRef(id);
    }
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
    this.editing?.layerVisibility.override(
      event.detail.id,
      event.detail.visible
    );
  }

  #onRename(
    event: CustomEvent<JollyRenameDetail>
  ): void {
    const editing = this.editing;
    if (editing === null) {
      return;
    }

    editing.layers.rename(parseLayerRef(event.detail.id), event.detail.name);
    this.#refreshNodes(editing);
  }

  #onToggleLock(
    event: CustomEvent<JollyToggleLockDetail>
  ): void {
    const editing = this.editing;
    if (editing === null) {
      return;
    }

    editing.layers.lock(parseLayerRef(event.detail.id), event.detail.locked);
    this.#refreshNodes(editing);
  }

  #onReparent(
    event: CustomEvent<JollyReparentDetail>
  ): void {
    const editing = this.editing;
    if (editing === null) {
      return;
    }

    editing.layers.reparent(event.detail);
    this.#refreshNodes(editing);
  }

  readonly #addLayer = async(): Promise<void> => {
    const editing = this.editing;
    if (editing === null) {
      return;
    }

    if (this._folder !== null && !this._folder.open) {
      this._folder.open = true;
    }

    const { objectLayer } = editing.state.selection;
    const result = await this._addDialog.open({
      canAddObject: objectLayer !== null &&
        editing.layers.canEdit("object"),
      defaultKind: objectLayer === null ? "voxel-layer" : "object",
      defaultName: editing.layers.defaultNames()
    });
    if (result !== null) {
      editing.layers.create(editing.focusPoint(), result);
    }
  };

  readonly #removeLayer = async(): Promise<void> => {
    const editing = this.editing;
    if (editing !== null && this._selection !== null) {
      await editing.layers.remove(this._selection);
    }
  };

  readonly #cloneLayer = (): void => {
    const editing = this.editing;
    if (editing !== null && this._selection !== null) {
      editing.layers.clone(this._selection);
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "layer-manager": LayerManager;
  }
}
