// Import Third-party Dependencies
import {
  html,
  css,
  nothing
} from "lit";
import {
  customElement,
  state
} from "lit/decorators.js";
import {
  formatCount,
  showConfirm,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import type { MapMaterial } from "./MapMaterial.ts";
import "./MaterialFinish.ts";

// CONSTANTS
const kNoMaterial = "";
const kNameTaken = "Another material of this blockset has this name";

@customElement("material-editor")
export class MaterialEditor extends WorkspaceElement {
  static override styles = css`
    :host {
      display: block;
    }

    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
    }

    .hint {
      margin: 0;
      padding: var(--jolly-space-1, 4px);
      color: var(--jolly-text-muted);
    }
  `;

  @state()
  private declare _renameError: string | null;

  constructor() {
    super();
    this._renameError = null;
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const refresh = (): void => this.requestUpdate();
    const { mapDocument } = workspace;

    return [
      workspace.state.block.subscribe("change", () => {
        this._renameError = null;
      }),
      mapDocument.subscribe("blockRegistryChanged", refresh),
      mapDocument.subscribe("materialGroupsChanged", refresh),
      mapDocument.subscribe("reset", refresh)
    ];
  }

  get #blockId(): number | null {
    const workspace = this.workspace;
    if (workspace === null) {
      return null;
    }

    const { id } = workspace.state.block;

    return workspace.mapDocument.blocks.get(id) === undefined ? null : id;
  }

  get #material(): MapMaterial | undefined {
    const blockId = this.#blockId;

    return blockId === null ?
      undefined :
      this.workspace?.materials.of(blockId);
  }

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    const blockId = this.#blockId;
    const available = blockId === null ?
      [] :
      workspace.materials.availableTo(blockId);
    const material = blockId === null ?
      undefined :
      available.find((entry) => entry.usedBy(blockId));

    return html`
      <jolly-folder
        key="material"
        label="Material"
        storage-key="voxel-map:folder:material"
      >
        <jolly-button
          slot="actions"
          icon="plus"
          icon-only
          label="New material"
          title="New material"
          ?disabled=${blockId === null}
          @click=${this.#create}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="trash"
          icon-only
          label="Delete material"
          title="Delete material"
          ?disabled=${material === undefined}
          @click=${this.#confirmRemove}
        ></jolly-button>
        ${blockId === null ?
          html`<p class="hint">Select a block to give it a material.</p>` :
          this.#renderFields(workspace, available, material)}
      </jolly-folder>
    `;
  }

  #renderFields(
    workspace: VoxelMapWorkspace,
    available: MapMaterial[],
    material: MapMaterial | undefined
  ) {
    const options: JollyOption<string>[] = [
      {
        label: "None",
        value: kNoMaterial
      },
      ...available.map((entry) => {
        return {
          label: entry.name,
          value: entry.id
        };
      })
    ];

    return html`
      <div class="fields">
        <jolly-select
          label="Material"
          label-position="auto"
          .options=${options}
          .value=${material?.id ?? kNoMaterial}
          @jolly-change=${this.#onAssign}
        ></jolly-select>
        ${material === undefined ? nothing : html`
          <jolly-text
            label="Name"
            label-position="auto"
            .value=${material.name}
            .error=${this._renameError}
            @jolly-change=${this.#onRename}
          ></jolly-text>
          <material-finish
            .materials=${workspace.materials}
            .material=${material}
          ></material-finish>
          <jolly-separator label="Stats"></jolly-separator>
          <jolly-text
            label="Used by"
            label-position="auto"
            readonly
            .value=${formatCount(material.blockIds.length, "block")}
          ></jolly-text>
        `}
      </div>
    `;
  }

  #onAssign(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    const workspace = this.workspace;
    const blockId = this.#blockId;
    if (workspace === null || blockId === null) {
      return;
    }

    const { value } = event.detail;
    const material = workspace.materials
      .availableTo(blockId)
      .find((entry) => entry.id === value);
    this._renameError = null;
    workspace.materials.assign(blockId, material ?? null);
  }

  #onRename(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    const material = this.#material;
    if (material === undefined) {
      return;
    }

    const renamed = this.workspace?.materials.rename(
      material,
      event.detail.value
    );
    this._renameError = renamed === "taken" ? kNameTaken : null;
  }

  #create(): void {
    const blockId = this.#blockId;
    if (blockId !== null) {
      this._renameError = null;
      this.workspace?.materials.create(blockId);
    }
  }

  async #confirmRemove(): Promise<void> {
    const material = this.#material;
    if (material === undefined) {
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
      this._renameError = null;
      this.workspace?.materials.remove(material);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "material-editor": MaterialEditor;
  }
}
