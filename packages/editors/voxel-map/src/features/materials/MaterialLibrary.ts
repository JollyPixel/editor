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
import type { VoxelMapEditing } from "../../editing/VoxelMapEditing.ts";
import { EditingElement } from "../../editing/EditingElement.ts";
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
export class MaterialLibrary extends EditingElement {
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

  protected override watchEditing(
    editing: VoxelMapEditing
  ): Iterable<() => void> {
    const refresh = (): void => this.requestUpdate();
    const { editorMap } = editing;
    this.#followBlock(editing);

    return [
      editing.state.block.subscribe("change", () => {
        this.#followBlock(editing);
      }),
      editing.blocksets.subscribe("change", refresh),
      editorMap.subscribe("blockRegistryChanged", refresh),
      editorMap.subscribe("materialGroupsChanged", refresh),
      editorMap.subscribe("reset", refresh)
    ];
  }

  override render() {
    const editing = this.editing;
    if (editing === null) {
      return nothing;
    }

    const shelves = this.#shelves(editing);
    const selectedId = this.#selectedIn(editing, shelves);
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
            editing,
            this.#defaultSlot(editing, shelves)
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
              this.#renderFields(editing, material, editable)}
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
    editing: VoxelMapEditing,
    material: MapMaterial,
    editable: boolean
  ) {
    return html`
      <div class="apply">
        ${this.#renderApply(
          editing,
          material,
          this.#blockUse(editing, material)
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
            editing.materials.refinish(material, {
              swatch: event.detail.value
            });
          }}
        ></jolly-color>
        <material-finish
          .materials=${editing.materials}
          .material=${material}
          .disabled=${!editable}
        ></material-finish>
      </div>
    `;
  }

  #renderApply(
    editing: VoxelMapEditing,
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
            @click=${() => editing.materials.assign(use.block.id, null)}
          >Remove from selected block</jolly-button>
        `;
      case "apply":
        return html`
          <jolly-button
            icon="material"
            variant="accent"
            title="Apply ${material.name} to ${use.block.name}"
            @click=${() => editing.materials.assign(use.block.id, material.id)}
          >Apply to selected block</jolly-button>
        `;
    }
  }

  #blockUse(
    editing: VoxelMapEditing,
    material: MapMaterial
  ): SelectedBlockUse {
    return material.useOn(
      this.#block(editing),
      (blockId) => editing.blocksets.canEditBlock(blockId)
    );
  }

  #openMenu(
    id: string | null
  ): MenuSession {
    const editing = this.editing;
    if (editing === null) {
      return MenuSession.EMPTY;
    }

    const shelves = this.#shelves(editing);
    if (id === null) {
      return this.#shelfMenu(editing, this.#defaultSlot(editing, shelves));
    }

    const material = shelves.material(id);
    if (material !== undefined) {
      return this.#materialMenu(editing, shelves, material);
    }

    const shelf = shelves.findShelf(id);

    return this.#shelfMenu(
      editing,
      shelf?.editable === true ? shelf.slot : undefined
    );
  }

  #shelfMenu(
    editing: VoxelMapEditing,
    slot: BlocksetSlot | undefined
  ): MenuSession {
    return MenuSession.from(
      disableEntries(SHELF_MENU, () => slot === undefined),
      () => this.#create(editing, slot)
    );
  }

  #materialMenu(
    editing: VoxelMapEditing,
    shelves: MaterialShelves,
    material: MapMaterial
  ): MenuSession {
    const commands = this.#commands(editing);
    const menu = new MaterialMenu({
      editable: shelves.canEdit(material.id),
      pristine: material.isDefault(),
      blockUse: this.#blockUse(editing, material).kind
    });

    return menu.session({
      exists: () => this.#shelves(editing).has(material.id),
      run: (command) => commands.run(command, material)
    });
  }

  #commands(
    editing: VoxelMapEditing
  ): MaterialCommands {
    return new MaterialCommands({
      materials: editing.materials,
      selectedBlock: () => this.#block(editing),
      rename: (materialId) => this._tree?.beginRename(materialId),
      select: (materialId) => this.#select(editing, materialId)
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
    editing: VoxelMapEditing,
    materialId: string | null
  ): Promise<void> {
    const shelf = materialId === null ?
      undefined :
      this.#shelves(editing).findShelf(materialId);
    if (shelf !== undefined) {
      this.#collapse(MaterialShelves.shelfNodeId(shelf.blocksetId), false);
    }

    this._selectedId = materialId;
    await this.updateComplete;
    await this._tree?.updateComplete;
  }

  #shelves(
    editing: VoxelMapEditing
  ): MaterialShelves {
    const { blocksets, materials } = editing;
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
    editing: VoxelMapEditing,
    shelves: MaterialShelves
  ): string | null {
    const selectedId = this._selectedId;
    if (selectedId !== null && shelves.has(selectedId)) {
      return selectedId;
    }

    return this.#blockMaterial(editing)?.id ?? null;
  }

  #block(
    editing: VoxelMapEditing
  ): ResolvedBlockDefinition | undefined {
    return editing.state.block.resolve(editing.editorMap.blocks);
  }

  #blockMaterial(
    editing: VoxelMapEditing
  ): MapMaterial | undefined {
    const block = this.#block(editing);

    return block === undefined ?
      undefined :
      editing.materials.findForBlock(block.id);
  }

  #followBlock(
    editing: VoxelMapEditing
  ): void {
    const material = this.#blockMaterial(editing);
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
    const editing = this.editing;
    const material = editing === null ?
      undefined :
      this.#shelves(editing).material(event.detail.id);
    if (material === undefined) {
      return;
    }

    const { name } = event.detail;
    this._selectedId = editing?.materials.rename(material, name) === "renamed" ?
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
    const editing = this.editing;
    if (editing === null) {
      return null;
    }

    const material = this.#shelves(editing).material(id);
    const taken = material !== undefined &&
      editing.materials.isNameTaken(material, name);

    return taken ? `${name.trim()} already exists` : null;
  };

  #defaultSlot(
    editing: VoxelMapEditing,
    shelves: MaterialShelves
  ): BlocksetSlot | undefined {
    const selectedId = this.#selectedIn(editing, shelves);
    const selectedShelf = selectedId === null ?
      undefined :
      shelves.findShelf(selectedId);
    const block = this.#block(editing);
    const blockOwner = block === undefined ?
      undefined :
      editing.blocksets.findOwner(block.id);
    const writable = shelves.editableShelves;
    const preferred = [selectedShelf?.slot, blockOwner?.slot].find(
      (slot) => writable.some((shelf) => shelf.slot === slot)
    );

    return preferred ?? writable[0]?.slot;
  }

  async #create(
    editing: VoxelMapEditing,
    slot: BlocksetSlot | undefined
  ): Promise<void> {
    const materialId = slot === undefined ?
      null :
      editing.materials.create(slot);
    if (materialId === null) {
      return;
    }

    await this.#select(editing, materialId);
    this._tree?.beginRename(materialId);
  }

  async #confirmRemove(): Promise<void> {
    const editing = this.editing;
    if (editing === null) {
      return;
    }

    const shelves = this.#shelves(editing);
    const selectedId = this.#selectedIn(editing, shelves);
    const material = selectedId === null ?
      undefined :
      shelves.material(selectedId);
    if (material !== undefined && shelves.canEdit(material.id)) {
      await this.#commands(editing).run("delete", material);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "material-library": MaterialLibrary;
  }
}
