// Import Third-party Dependencies
import {
  html,
  nothing
} from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
import {
  ContextMenuController,
  MenuSession,
  disableEntries,
  type ContextMenu,
  type JollyActivateSwatchDetail,
  type JollyChangeDetail,
  type JollyRenameDetail,
  type JollySelectDetail,
  type JollyToggleExpandDetail,
  type Tree,
  type TreeRenameValidator
} from "@jolly-pixel/ui";
import type {
  BlocksetSlot,
  ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import { hintStyles } from "../../shared/styles/hint.styles.ts";
import type {
  MapMaterial,
  SelectedBlockUse
} from "./MapMaterial.ts";
import { MaterialCommands } from "./MaterialCommands.ts";
import {
  MaterialMenu,
  SHELF_MENU
} from "./MaterialMenu.ts";
import {
  MaterialShelves,
  type MaterialShelf
} from "./MaterialShelves.ts";
import { materialLibraryStyles } from "./MaterialLibrary.styles.ts";
import "./MaterialFinish.ts";

@customElement("material-library")
export class MaterialLibrary extends WorkspaceElement {
  static override styles = [hintStyles, materialLibraryStyles];

  @state()
  private declare _selectedId: string | null;

  @state()
  private declare _collapsed: ReadonlySet<string>;

  @query("jolly-tree")
  private declare _tree: Tree | null;

  @query("jolly-context-menu")
  private declare _contextMenu: ContextMenu;

  #menu = new ContextMenuController(
    () => this._contextMenu,
    (id) => this.#openMenu(id)
  );

  constructor() {
    super();
    this._selectedId = null;
    this._collapsed = new Set();
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const refresh = (): void => this.requestUpdate();
    const { mapDocument } = workspace;
    this.#followBlock(workspace);

    return [
      workspace.state.block.subscribe("change", () => {
        this.#followBlock(workspace);
      }),
      workspace.blocksets.subscribe("change", refresh),
      mapDocument.subscribe("blockRegistryChanged", refresh),
      mapDocument.subscribe("materialGroupsChanged", refresh),
      mapDocument.subscribe("reset", refresh)
    ];
  }

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    const shelves = this.#shelves(workspace);
    const selectedId = this.#selectedIn(workspace, shelves);
    const material = selectedId === null ?
      undefined :
      shelves.material(selectedId);
    const editable = material !== undefined && shelves.canEdit(material.id);

    return html`
      <jolly-folder
        flush
        key="materials"
        label="Materials"
        storage-key="voxel-map:folder:materials"
      >
        <jolly-button
          slot="actions"
          icon="plus"
          icon-only
          label="New material"
          title="New material"
          ?disabled=${shelves.editableShelves.length === 0}
          @click=${() => this.#create(
            workspace,
            this.#defaultSlot(workspace, shelves)
          )}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="trash"
          variant="danger"
          icon-only
          label="Delete material"
          title="Delete material"
          ?disabled=${!editable}
          @click=${this.#confirmRemove}
        ></jolly-button>
        <div class="layout">
          <section class="library">
            <jolly-tree
              .nodes=${shelves.toTreeNodes()}
              .selected=${selectedId === null ? [] : [selectedId]}
              .expanded=${this.#expanded(shelves)}
              .validateRename=${this.#validateRename}
              renamable
              indent-guides
              toggle-style="box"
              swatch-position="start"
              @jolly-select=${this.#onSelect}
              @jolly-activate-swatch=${this.#onActivateSwatch}
              @jolly-rename=${this.#onRename}
              @jolly-toggle-expand=${this.#onToggleExpand}
              @jolly-context-request=${this.#menu.onContextRequest}
            ></jolly-tree>
            ${shelves.materialCount === 0 ?
              html`<p class="hint">No materials yet.</p>` :
              nothing}
          </section>
          <section class="editor">
            ${material === undefined ?
              html`<p class="hint">Pick a material or create one.</p>` :
              this.#renderFields(workspace, material, editable)}
          </section>
        </div>
      </jolly-folder>
      <jolly-context-menu
        label="Material actions"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
    `;
  }

  #renderFields(
    workspace: VoxelMapWorkspace,
    material: MapMaterial,
    editable: boolean
  ) {
    return html`
      <div class="apply">
        ${this.#renderApply(
          workspace,
          material,
          this.#blockUse(workspace, material)
        )}
      </div>
      ${editable ?
        nothing :
        html`<p class="hint">This blockset's materials are read-only.</p>`}
      <div class="fields">
        <jolly-color
          label="Swatch"
          label-position="auto"
          description="Marks this material in the tree and on block library tiles"
          description-display="tooltip"
          ?disabled=${!editable}
          .value=${material.swatch.color}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => {
            workspace.materials.refinish(material, {
              swatch: event.detail.value
            });
          }}
        ></jolly-color>
        <material-finish
          .materials=${workspace.materials}
          .material=${material}
          .disabled=${!editable}
        ></material-finish>
      </div>
    `;
  }

  #renderApply(
    workspace: VoxelMapWorkspace,
    material: MapMaterial,
    use: SelectedBlockUse
  ) {
    switch (use.kind) {
      case "blocked":
        return html`
          <jolly-button
            icon="material"
            title=${use.reason}
            disabled
          >Apply to selected block</jolly-button>
        `;
      case "unapply":
        return html`
          <jolly-button
            icon="close"
            variant="danger"
            title="Remove ${material.name} from ${use.block.name}"
            @click=${() => workspace.materials.assign(use.block.id, null)}
          >Remove from selected block</jolly-button>
        `;
      case "apply":
        return html`
          <jolly-button
            icon="material"
            variant="accent"
            title="Apply ${material.name} to ${use.block.name}"
            @click=${() => workspace.materials.assign(use.block.id, material.id)}
          >Apply to selected block</jolly-button>
        `;
    }
  }

  #blockUse(
    workspace: VoxelMapWorkspace,
    material: MapMaterial
  ): SelectedBlockUse {
    return material.useOn(
      this.#block(workspace),
      (blockId) => workspace.blocksets.canEditBlock(blockId)
    );
  }

  #openMenu(
    id: string | null
  ): MenuSession {
    const workspace = this.workspace;
    if (workspace === null) {
      return MenuSession.EMPTY;
    }

    const shelves = this.#shelves(workspace);
    if (id === null) {
      return this.#shelfMenu(workspace, this.#defaultSlot(workspace, shelves));
    }

    const material = shelves.material(id);
    if (material !== undefined) {
      return this.#materialMenu(workspace, shelves, material);
    }

    const shelf = shelves.findShelf(id);

    return this.#shelfMenu(
      workspace,
      shelf?.editable === true ? shelf.slot : undefined
    );
  }

  #shelfMenu(
    workspace: VoxelMapWorkspace,
    slot: BlocksetSlot | undefined
  ): MenuSession {
    return MenuSession.from(
      disableEntries(SHELF_MENU, () => slot === undefined),
      () => this.#create(workspace, slot)
    );
  }

  #materialMenu(
    workspace: VoxelMapWorkspace,
    shelves: MaterialShelves,
    material: MapMaterial
  ): MenuSession {
    const commands = this.#commands(workspace);
    const menu = new MaterialMenu({
      editable: shelves.canEdit(material.id),
      pristine: material.isDefault(),
      blockUse: this.#blockUse(workspace, material).kind
    });

    return menu.session({
      exists: () => this.#shelves(workspace).has(material.id),
      run: (command) => commands.run(command, material)
    });
  }

  #commands(
    workspace: VoxelMapWorkspace
  ): MaterialCommands {
    return new MaterialCommands({
      materials: workspace.materials,
      selectedBlock: () => this.#block(workspace),
      rename: (materialId) => this._tree?.beginRename(materialId),
      select: (materialId) => this.#select(workspace, materialId)
    });
  }

  #expanded(
    shelves: MaterialShelves
  ): string[] {
    return [...shelves]
      .map((shelf) => MaterialShelves.shelfNodeId(shelf.blocksetId))
      .filter((id) => !this._collapsed.has(id));
  }

  #collapse(
    shelfNodeId: string,
    collapsed: boolean
  ): void {
    const next = new Set(this._collapsed);
    if (collapsed) {
      next.add(shelfNodeId);
    }
    else {
      next.delete(shelfNodeId);
    }
    this._collapsed = next;
  }

  async #select(
    workspace: VoxelMapWorkspace,
    materialId: string | null
  ): Promise<void> {
    const shelf = materialId === null ?
      undefined :
      this.#shelves(workspace).findShelf(materialId);
    if (shelf !== undefined) {
      this.#collapse(MaterialShelves.shelfNodeId(shelf.blocksetId), false);
    }

    this._selectedId = materialId;
    await this.updateComplete;
    await this._tree?.updateComplete;
  }

  #shelves(
    workspace: VoxelMapWorkspace
  ): MaterialShelves {
    const { blocksets, materials } = workspace;
    const shelves: MaterialShelf[] = [];
    for (const entry of blocksets.entries) {
      const binding = blocksets.open(entry.id);
      if (binding !== undefined) {
        shelves.push({
          blocksetId: entry.id,
          label: entry.label,
          slot: binding.slot,
          materials: materials.inSlot(binding.slot),
          editable: binding.access.current.has("materials")
        });
      }
    }

    return new MaterialShelves(shelves);
  }

  #selectedIn(
    workspace: VoxelMapWorkspace,
    shelves: MaterialShelves
  ): string | null {
    const selectedId = this._selectedId;
    if (selectedId !== null && shelves.has(selectedId)) {
      return selectedId;
    }

    return this.#blockMaterial(workspace)?.id ?? null;
  }

  #block(
    workspace: VoxelMapWorkspace
  ): ResolvedBlockDefinition | undefined {
    return workspace.state.block.resolve(workspace.mapDocument.blocks);
  }

  #blockMaterial(
    workspace: VoxelMapWorkspace
  ): MapMaterial | undefined {
    const block = this.#block(workspace);

    return block === undefined ?
      undefined :
      workspace.materials.findForBlock(block.id);
  }

  #followBlock(
    workspace: VoxelMapWorkspace
  ): void {
    const material = this.#blockMaterial(workspace);
    if (material !== undefined) {
      this._selectedId = material.id;
    }
    this.requestUpdate();
  }

  readonly #onSelect = (
    event: CustomEvent<JollySelectDetail>
  ): void => {
    this._selectedId = event.detail.selected[0] ?? null;
  };

  readonly #onActivateSwatch = (
    event: CustomEvent<JollyActivateSwatchDetail>
  ): void => {
    this._selectedId = event.detail.id;
  };

  readonly #onRename = (
    event: CustomEvent<JollyRenameDetail>
  ): void => {
    const workspace = this.workspace;
    const material = workspace === null ?
      undefined :
      this.#shelves(workspace).material(event.detail.id);
    if (material === undefined) {
      return;
    }

    const { name } = event.detail;
    this._selectedId = workspace?.materials.rename(material, name) === "renamed" ?
      material.slot.qualifyGroupId(name.trim()) :
      material.id;
  };

  readonly #onToggleExpand = (
    event: CustomEvent<JollyToggleExpandDetail>
  ): void => {
    const { id, expanded } = event.detail;
    this.#collapse(id, !expanded);
  };

  readonly #validateRename: TreeRenameValidator = ({ id, name }) => {
    const workspace = this.workspace;
    if (workspace === null) {
      return null;
    }

    const material = this.#shelves(workspace).material(id);
    const taken = material !== undefined &&
      workspace.materials.isNameTaken(material, name);

    return taken ? `${name.trim()} already exists` : null;
  };

  #defaultSlot(
    workspace: VoxelMapWorkspace,
    shelves: MaterialShelves
  ): BlocksetSlot | undefined {
    const selectedId = this.#selectedIn(workspace, shelves);
    const selectedShelf = selectedId === null ?
      undefined :
      shelves.findShelf(selectedId);
    const block = this.#block(workspace);
    const blockOwner = block === undefined ?
      undefined :
      workspace.blocksets.findOwner(block.id);
    const writable = shelves.editableShelves;
    const preferred = [selectedShelf?.slot, blockOwner?.slot].find(
      (slot) => writable.some((shelf) => shelf.slot === slot)
    );

    return preferred ?? writable[0]?.slot;
  }

  async #create(
    workspace: VoxelMapWorkspace,
    slot: BlocksetSlot | undefined
  ): Promise<void> {
    const materialId = slot === undefined ?
      null :
      workspace.materials.create(slot);
    if (materialId === null) {
      return;
    }

    await this.#select(workspace, materialId);
    this._tree?.beginRename(materialId);
  }

  async #confirmRemove(): Promise<void> {
    const workspace = this.workspace;
    if (workspace === null) {
      return;
    }

    const shelves = this.#shelves(workspace);
    const selectedId = this.#selectedIn(workspace, shelves);
    const material = selectedId === null ?
      undefined :
      shelves.material(selectedId);
    if (material !== undefined && shelves.canEdit(material.id)) {
      await this.#commands(workspace).run("delete", material);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "material-library": MaterialLibrary;
  }
}
