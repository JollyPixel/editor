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
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
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
export class LayerManager extends WorkspaceElement {
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

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { selection, presence } = workspace.state;
    const refresh = (): void => this.#refreshNodes(workspace);
    this._selection = selection.current;
    refresh();

    return [
      workspace.mapDocument.subscribe("layerUpdated", refresh),
      workspace.mapDocument.subscribe("reset", refresh),
      presence.subscribe("layerSelectionsChange", refresh),
      workspace.layerVisibility.subscribe("change", refresh),
      workspace.access.subscribe("change", refresh),
      workspace.usage.subscribe("change", () => this.requestUpdate()),
      selection.subscribe("change", (current) => {
        this._selection = current;
        this.#expandSelectedLayer(current);
      })
    ];
  }

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    const { layers } = workspace;
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
        >${formatCount(workspace.usage.stats.voxels, "voxel")}</span>
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
        ${this.#renderInspector(workspace)}
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
    const workspace = this.workspace;
    if (workspace === null) {
      return MenuSession.EMPTY;
    }

    const menu = new LayerMenu({
      world: workspace.mapDocument.world,
      layers: workspace.layers,
      templatesEditable: workspace.templates.editable,
      commands: new LayerCommands({
        workspace,
        rename: (ref) => this._tree?.beginRename(ref.key),
        addLayer: this.#addLayer
      })
    });

    return id === null ? menu.rootSession() : menu.session(parseLayerRef(id));
  }

  #renderInspector(
    workspace: VoxelMapWorkspace
  ) {
    const { world } = workspace.mapDocument;
    const selection = this._selection;
    if (selection === null) {
      return nothing;
    }
    const writable = workspace.layers.canEdit(selection.kind);

    switch (selection.kind) {
      case "voxel-layer":
        return html`<layer-panel
          .world=${world}
          .selection=${workspace.state.selection}
          .placement=${workspace.placement}
          .mapDocument=${workspace.mapDocument}
          .layerName=${selection.name}
          .writable=${writable}
        ></layer-panel>`;
      case "object":
        return html`<object-panel
          .world=${world}
          .mapDocument=${workspace.mapDocument}
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
    workspace: VoxelMapWorkspace
  ): void {
    this._nodes = withLayerBadges(
      layerTreeNodes(
        workspace.mapDocument.world,
        workspace.layerVisibility,
        workspace.layers
      ),
      workspace.state.presence.layerSelections
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
    if (id !== undefined && this.workspace !== null) {
      this.workspace.state.selection.current = parseLayerRef(id);
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
    this.workspace?.layerVisibility.override(
      event.detail.id,
      event.detail.visible
    );
  }

  #onRename(
    event: CustomEvent<JollyRenameDetail>
  ): void {
    const workspace = this.workspace;
    if (workspace === null) {
      return;
    }

    workspace.layers.rename(parseLayerRef(event.detail.id), event.detail.name);
    this.#refreshNodes(workspace);
  }

  #onToggleLock(
    event: CustomEvent<JollyToggleLockDetail>
  ): void {
    const workspace = this.workspace;
    if (workspace === null) {
      return;
    }

    workspace.layers.lock(parseLayerRef(event.detail.id), event.detail.locked);
    this.#refreshNodes(workspace);
  }

  #onReparent(
    event: CustomEvent<JollyReparentDetail>
  ): void {
    const workspace = this.workspace;
    if (workspace === null) {
      return;
    }

    workspace.layers.reparent(event.detail);
    this.#refreshNodes(workspace);
  }

  readonly #addLayer = async(): Promise<void> => {
    const workspace = this.workspace;
    if (workspace === null) {
      return;
    }

    if (this._folder !== null && !this._folder.open) {
      this._folder.open = true;
    }

    const { objectLayer } = workspace.state.selection;
    const result = await this._addDialog.open({
      canAddObject: objectLayer !== null &&
        workspace.layers.canEdit("object"),
      defaultKind: objectLayer === null ? "voxel-layer" : "object",
      defaultName: workspace.layers.defaultNames()
    });
    if (result !== null) {
      workspace.layers.create(workspace.focusPoint(), result);
    }
  };

  readonly #removeLayer = async(): Promise<void> => {
    const workspace = this.workspace;
    if (workspace !== null && this._selection !== null) {
      await workspace.layers.remove(this._selection);
    }
  };

  readonly #cloneLayer = (): void => {
    const workspace = this.workspace;
    if (workspace !== null && this._selection !== null) {
      workspace.layers.clone(this._selection);
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "layer-manager": LayerManager;
  }
}
