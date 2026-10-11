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
  formatCount,
  showConfirm,
  type JollyActivateSwatchDetail,
  type JollyChangeDetail,
  type JollyRenameDetail,
  type JollySelectDetail,
  type Tree
} from "@jolly-pixel/ui";
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import { hintStyles } from "../../shared/styles/hint.styles.ts";
import type { MapMaterial } from "./MapMaterial.ts";
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

  @query("jolly-tree")
  private declare _tree: Tree | null;

  constructor() {
    super();
    this._selectedId = null;
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
    const block = this.#block(workspace);

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
          @click=${this.#create}
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
              renamable
              swatch-position="start"
              @jolly-select=${this.#onSelect}
              @jolly-activate-swatch=${this.#onActivateSwatch}
              @jolly-rename=${this.#onRename}
            ></jolly-tree>
            ${shelves.materialCount === 0 ?
              html`<p class="hint">No materials yet.</p>` :
              nothing}
          </section>
          <section class="editor">
            ${material === undefined ?
              html`<p class="hint">Pick a material or create one.</p>` :
              this.#renderFields(workspace, material, block, editable)}
          </section>
        </div>
      </jolly-folder>
    `;
  }

  #renderFields(
    workspace: VoxelMapWorkspace,
    material: MapMaterial,
    block: ResolvedBlockDefinition | undefined,
    editable: boolean
  ) {
    return html`
      <div class="apply">
        ${this.#renderApply(workspace, material, block)}
      </div>
      <div class="fields">
        <jolly-separator label="Properties"></jolly-separator>
        <jolly-color
          label="Color"
          label-position="auto"
          description="Swatch shown on the blocks using this material"
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
    block: ResolvedBlockDefinition | undefined
  ) {
    if (
      block === undefined ||
      !material.slot.ownsBlockId(block.id) ||
      !workspace.blocksets.canEditBlock(block.id)
    ) {
      return html`
        <jolly-button
          icon="material"
          title=${applyBlockedReason(material, block)}
          disabled
        >Apply to selected block</jolly-button>
      `;
    }
    if (material.usedBy(block.id)) {
      return html`
        <jolly-button
          icon="close"
          variant="danger"
          title="Remove ${material.name} from ${block.name}"
          @click=${() => workspace.materials.assign(block.id, null)}
        >Remove from selected block</jolly-button>
      `;
    }

    return html`
      <jolly-button
        icon="material"
        variant="accent"
        title="Apply ${material.name} to ${block.name}"
        @click=${() => workspace.materials.assign(block.id, material)}
      >Apply to selected block</jolly-button>
    `;
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

    return workspace.materials.findForBlock(workspace.state.block.id)?.id ?? null;
  }

  #block(
    workspace: VoxelMapWorkspace
  ): ResolvedBlockDefinition | undefined {
    return workspace.mapDocument.blocks.get(workspace.state.block.id);
  }

  #followBlock(
    workspace: VoxelMapWorkspace
  ): void {
    const material = workspace.materials.findForBlock(workspace.state.block.id);
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

  async #create(): Promise<void> {
    const workspace = this.workspace;
    if (workspace === null) {
      return;
    }

    const shelves = this.#shelves(workspace);
    const selectedId = this.#selectedIn(workspace, shelves);
    const selectedShelf = selectedId === null ?
      undefined :
      shelves.findShelf(selectedId);
    const blockOwner = workspace.blocksets.findOwner(workspace.state.block.id);
    const writable = shelves.editableShelves;
    const preferred = [selectedShelf?.slot, blockOwner?.slot].find(
      (slot) => writable.some((shelf) => shelf.slot === slot)
    );
    const target = preferred ?? writable[0]?.slot;
    const materialId = target === undefined ?
      null :
      workspace.materials.create(target);
    if (materialId === null) {
      return;
    }

    this._selectedId = materialId;
    await this.updateComplete;
    await this._tree?.updateComplete;
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
    if (material === undefined || !shelves.canEdit(material.id)) {
      return;
    }

    const users = material.blockIds.length;
    const confirmed = users <= 1 || await showConfirm({
      title: "Delete material",
      message: `${material.name} is used by ${formatCount(users, "block")}. ` +
        "They will have no material.",
      confirmLabel: "Delete",
      icon: "trash",
      danger: true
    });
    if (confirmed) {
      this._selectedId = null;
      workspace.materials.remove(material);
    }
  }
}

function applyBlockedReason(
  material: MapMaterial,
  block: ResolvedBlockDefinition | undefined
): string {
  if (block === undefined) {
    return "Select a block to apply this material";
  }

  return material.slot.ownsBlockId(block.id) ?
    "You can only view the blocks of this blockset" :
    `${block.name} belongs to another blockset`;
}

declare global {
  interface HTMLElementTagNameMap {
    "material-library": MaterialLibrary;
  }
}
