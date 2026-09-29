// Import Third-party Dependencies
import { html, nothing } from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type {
  JollyRenameDetail,
  JollyReparentDetail,
  JollySelectDetail,
  JollyToggleLockDetail,
  JollyToggleVisibleDetail,
  TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  layerKey,
  parseLayerKey,
  type LayerRef
} from "../../state/index.ts";
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import { formatCount } from "../../shared/format.ts";
import { AddLayerDialog } from "./AddLayerDialog.ts";
import { layerManagerStyles } from "./LayerManager.styles.ts";
import { MergeLayerDialog } from "./MergeLayerDialog.ts";
import {
  cloneLayerEntry,
  createLayerEntry,
  mergeLayerEntry,
  removeLayerEntry,
  renameLayerEntry,
  setLayerEntryLocked
} from "./layerActions.ts";
import {
  applyLayerReparent,
  canDropLayerRef
} from "./layerDrop.ts";
import {
  layerTreeNodes,
  withLayerBadges
} from "./layerTree.ts";
import "./objects/ObjectPanel.ts";
import "./voxel/VoxelLayerPanel.ts";

@customElement("layer-manager")
export class LayerManager extends WorkspaceElement {
  static override styles = layerManagerStyles;

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

  @query("merge-layer-dialog")
  private declare _mergeDialog: MergeLayerDialog;

  constructor() {
    super();
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
      workspace.usage.subscribe("change", () => this.requestUpdate()),
      selection.subscribe("change", (current) => {
        this._selection = current;
        this.#expandLayerOf(current);
      })
    ];
  }

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    const world = workspace.engine.document.world;
    const voxelLayerSelected = this._selection?.kind === "voxel-layer";

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
          icon="merge"
          icon-only
          label="Merge layer"
          title="Merge layer into another"
          ?disabled=${!voxelLayerSelected || world.getLayers().length < 2}
          @click=${this.#mergeLayer}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="trash"
          icon-only
          variant="danger"
          label="Remove layer"
          title="Remove layer"
          ?disabled=${this._selection === null}
          @click=${this.#removeLayer}
        ></jolly-button>

        <div class="tree-host">
          <jolly-tree
            require-selection
            renamable
            reorderable
            row-drag
            .nodes=${this._nodes}
            .selected=${this._selection === null ? [] : [layerKey(this._selection)]}
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
        ${this.#renderInspector(workspace, world)}
      </jolly-folder>

      <add-layer-dialog></add-layer-dialog>
      <merge-layer-dialog></merge-layer-dialog>
    `;
  }

  #renderInspector(
    workspace: VoxelMapWorkspace,
    world: VoxelWorld
  ) {
    const selection = this._selection;
    if (selection === null) {
      return nothing;
    }

    switch (selection.kind) {
      case "voxel-layer":
        return html`<layer-panel
          .world=${world}
          .selection=${workspace.state.selection}
          .mapDocument=${workspace.mapDocument}
          .layerName=${selection.name}
        ></layer-panel>`;
      case "object":
        return html`<object-panel
          .world=${world}
          .mapDocument=${workspace.mapDocument}
          .layerName=${selection.layerName}
          .objectId=${selection.objectId}
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
      layerTreeNodes(workspace.engine.document.world, workspace.layerVisibility),
      workspace.state.presence.layerSelections
    );
  }

  #expandLayerOf(
    selection: LayerRef | null
  ): void {
    if (selection?.kind !== "object") {
      return;
    }

    const id = layerKey({
      kind: "object-layer",
      name: selection.layerName
    });
    if (!this._expanded.includes(id)) {
      this._expanded = [...this._expanded, id];
    }
  }

  #onSelect(
    event: CustomEvent<JollySelectDetail>
  ): void {
    const [id] = event.detail.selected;
    if (id !== undefined && this.workspace !== null) {
      this.workspace.state.selection.current = parseLayerKey(id);
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

    renameLayerEntry(
      workspace.engine.document.world,
      parseLayerKey(event.detail.id),
      event.detail.name
    );
    this.#refreshNodes(workspace);
  }

  #onToggleLock(
    event: CustomEvent<JollyToggleLockDetail>
  ): void {
    const workspace = this.workspace;
    if (workspace === null) {
      return;
    }

    setLayerEntryLocked(
      workspace.engine.document.world,
      parseLayerKey(event.detail.id),
      event.detail.locked
    );
    this.#refreshNodes(workspace);
  }

  #onReparent(
    event: CustomEvent<JollyReparentDetail>
  ): void {
    const workspace = this.workspace;
    if (workspace === null) {
      return;
    }

    applyLayerReparent(workspace.engine.document.world, event.detail);
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

    const world = workspace.engine.document.world;
    const { selection } = workspace.state;
    const objectLayer = selection.objectLayer;
    const result = await this._addDialog.open({
      canAddObject: objectLayer !== null,
      defaultKind: objectLayer === null ? "voxel-layer" : "object",
      defaultName: {
        "voxel-layer": `Layer ${world.getLayers().length + 1}`,
        "object-layer": `Objects ${world.objectLayers.toArray().length + 1}`,
        object: "Object"
      }
    });
    if (result !== null) {
      createLayerEntry(world, selection, workspace.focusPoint(), result);
    }
  };

  readonly #removeLayer = async(): Promise<void> => {
    const workspace = this.workspace;
    if (workspace !== null && this._selection !== null) {
      await removeLayerEntry(workspace.engine.document.world, this._selection);
    }
  };

  readonly #cloneLayer = (): void => {
    const workspace = this.workspace;
    if (workspace !== null && this._selection !== null) {
      cloneLayerEntry(
        workspace.engine.document.world,
        workspace.state.selection,
        this._selection
      );
    }
  };

  readonly #mergeLayer = async(): Promise<void> => {
    const workspace = this.workspace;
    if (workspace === null || this._selection === null) {
      return;
    }

    await mergeLayerEntry(
      workspace.engine.document.world,
      workspace.state.selection,
      this._selection,
      (context) => this._mergeDialog.open(context)
    );
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "layer-manager": LayerManager;
  }
}
