// Import Third-party Dependencies
import {
  html,
  css,
  nothing
} from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";
import {
  formatCount,
  showConfirm
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../../workspace/WorkspaceElement.ts";
import type { BlockCreateDialog } from "../dialogs/BlockCreateDialog.ts";
import type { BlockEditDialog } from "../dialogs/BlockEditDialog.ts";
import { BlockUsage } from "../usage/BlockUsage.ts";
import { BlockLibraryOrder } from "./BlockLibraryOrder.ts";
import { PeerMarks } from "./PeerMarks.ts";
import type { MaterialSwatch } from "../../materials/MaterialSwatch.ts";
import type { BlockLibraryViewport } from "./BlockLibraryViewport.ts";
import type { BlockMoveDetail } from "./BlockReorderController.ts";
import "./BlockLibraryViewport.ts";
import "../dialogs/BlockCreateDialog.ts";
import "../dialogs/BlockEditDialog.ts";
import "../blockIcons.ts";

export type BlockLibraryLayout = "compact" | "fill";

@customElement("block-library")
export class BlockLibrary extends WorkspaceElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      overflow: hidden;
    }

    :host([layout="fill"]) {
      flex: 1 1 auto;
      min-height: 0;
    }

    .problems {
      display: flex;
      flex: 0 0 auto;
      justify-content: center;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
      margin-block-end: calc(-1 * var(--jolly-row-gap, 4px));
      padding: 1px var(--jolly-space-1, 4px);
      border: 0;
      border-radius: 0;
      background: color-mix(in srgb, var(--jolly-danger) 14%, transparent);
      color: var(--jolly-danger);
      font: inherit;
      text-align: center;
      cursor: pointer;
    }

    .problems:hover {
      background: color-mix(in srgb, var(--jolly-danger) 22%, transparent);
    }
  `;

  @property({ attribute: false })
  declare order: BlockLibraryOrder;

  @property({ type: Boolean })
  declare editable: boolean;

  @property({ type: String, reflect: true })
  declare layout: BlockLibraryLayout;

  @state()
  private declare _selectedId: number | null;

  @state()
  private declare _blocks: ResolvedBlockDefinition[];

  @state()
  private declare _shownBlocks: ResolvedBlockDefinition[];

  @state()
  private declare _marks: PeerMarks<number>;

  @state()
  private declare _unused: ReadonlySet<number>;

  @state()
  private declare _swatches: ReadonlyMap<number, MaterialSwatch>;

  @query("block-create-dialog")
  declare private _createDialog: BlockCreateDialog;

  @query("block-edit-dialog")
  declare private _editDialog: BlockEditDialog;

  @query("block-library-viewport")
  declare private _viewport: BlockLibraryViewport | null;

  constructor() {
    super();

    this.order = BlockLibraryOrder.Registry;
    this.layout = "compact";
    this.editable = true;
    this._selectedId = null;
    this._blocks = [];
    this._shownBlocks = [];
    this._marks = new PeerMarks();
    this._unused = new Set();
    this._swatches = new Map();
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { block, presence } = workspace.state;
    const refreshMarks = (): void => this.#refreshMarks(workspace);
    const refreshSwatches = (): void => this.#refreshSwatches(workspace);
    this.#resolveSelection(workspace);
    this.#refreshBlocks(workspace);
    this.#refreshUsage(workspace);
    this.#refreshSwatches(workspace);

    return [
      block.subscribe("change", () => {
        this.#resolveSelection(workspace);
        void this.#revealSelection();
      }),
      workspace.mapDocument.subscribe("blockRegistryChanged", () => {
        this.#resolveSelection(workspace);
        this.#refreshBlocks(workspace);
        refreshSwatches();
      }),
      workspace.mapDocument.subscribe("materialGroupsChanged", refreshSwatches),
      presence.subscribe("blockSelectionsChange", refreshMarks),
      presence.subscribe("peersChange", refreshMarks),
      workspace.blocksets.subscribe("change", () => this.requestUpdate()),
      workspace.access.subscribe("change", () => this.requestUpdate()),
      workspace.usage.subscribe("change", () => this.#refreshUsage(workspace))
    ];
  }

  override willUpdate(
    changed: Map<string, unknown>
  ) {
    const workspace = this.workspace;
    if (changed.has("order") && workspace !== null) {
      this.#refreshShownBlocks(workspace);
      void this.#revealSelection();
    }
  }

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    const editable = this.editable &&
      workspace.blocksets.entriesGranting("blocks").length > 0;
    const cleanable = this.editable && workspace.access.current.has("voxels");

    return html`
      ${cleanable ? this.#renderOrphans(workspace) : nothing}
      <block-library-viewport
        .sources=${workspace.blockSources}
        .blocks=${this._shownBlocks}
        .marks=${this._marks}
        .selectedId=${this._selectedId}
        .unused=${this._unused}
        .swatches=${this._swatches}
        .editable=${editable}
        .reorderable=${editable && this.order.reorderable}
        .layout=${this.layout}
        @block-select=${this.#onBlockSelect}
        @block-edit=${this.#onBlockEdit}
        @block-move=${this.#onBlockMove}
        @block-create=${this.#onBlockCreate}
      ></block-library-viewport>

      <slot></slot>

      ${editable ? html`
        <block-create-dialog .workspace=${workspace}></block-create-dialog>
        <block-edit-dialog .workspace=${workspace}></block-edit-dialog>
      ` : nothing}
    `;
  }

  #renderOrphans(
    workspace: VoxelMapWorkspace
  ) {
    const { orphanVoxels } = workspace.usage.stats;
    if (orphanVoxels === 0) {
      return nothing;
    }

    return html`
      <button
        type="button"
        class="problems orphans"
        title="Remove the voxels of deleted blocks"
        @click=${this.#confirmRemoveOrphans}
      >
        <jolly-icon name="warning"></jolly-icon>
        <span>${formatCount(orphanVoxels, "voxel")} of deleted blocks</span>
      </button>
    `;
  }

  async #confirmRemoveOrphans(): Promise<void> {
    const workspace = this.workspace;
    if (workspace === null || workspace.usage.stats.orphanVoxels === 0) {
      return;
    }

    const { orphanVoxels, orphanBlocks } = workspace.usage.stats;

    const confirmed = await showConfirm({
      title: "Remove orphan voxels",
      message: BlockUsage.orphanMessage(orphanVoxels, orphanBlocks),
      confirmLabel: "Remove",
      icon: "trash",
      danger: true
    });
    if (confirmed) {
      workspace.mapDocument.world.removeBlocks(orphanBlocks);
    }
  }

  #onBlockSelect(
    event: CustomEvent<{ id: number; }>
  ): void {
    this.attached.state.block.id = event.detail.id;
  }

  #onBlockEdit(
    event: CustomEvent<{ id: number; }>
  ): void {
    this.attached.state.block.id = event.detail.id;
    void this.editBlock();
  }

  #onBlockMove(
    event: CustomEvent<BlockMoveDetail>
  ): void {
    this.workspace?.blocksets.moveBlock(event.detail.id, event.detail.toIndex);
  }

  #onBlockCreate(): void {
    void this._createDialog?.open();
  }

  async editBlock(): Promise<void> {
    const id = this._selectedId;
    if (id === null || this.workspace?.blocksets.canEditBlock(id) !== true) {
      return;
    }

    await this.updateComplete;
    await this._editDialog?.open(id);
  }

  async #revealSelection(): Promise<void> {
    const id = this._selectedId;
    if (id === null) {
      return;
    }

    await this.updateComplete;
    this._viewport?.revealBlock(id);
  }

  #refreshMarks(
    workspace: VoxelMapWorkspace
  ): void {
    const { presence } = workspace.state;
    this._marks = PeerMarks.withSelf(
      presence.blockSelections,
      this._selectedId,
      presence.peers
    );
  }

  #resolveSelection(
    workspace: VoxelMapWorkspace
  ): void {
    this._selectedId = workspace.state.block.id;
    this.#refreshMarks(workspace);
  }

  #refreshBlocks(
    workspace: VoxelMapWorkspace
  ): void {
    this._blocks = [...workspace.mapDocument.blocks.getAll()];
    this.#refreshShownBlocks(workspace);
  }

  #refreshUsage(
    workspace: VoxelMapWorkspace
  ): void {
    const { unusedBlocks } = workspace.usage.stats;
    if (
      unusedBlocks.length !== this._unused.size ||
      unusedBlocks.some((id) => !this._unused.has(id))
    ) {
      this._unused = new Set(unusedBlocks);
    }
    this.#refreshShownBlocks(workspace);
    this.requestUpdate();
  }

  #refreshSwatches(
    workspace: VoxelMapWorkspace
  ): void {
    this._swatches = workspace.materials.swatches();
  }

  #refreshShownBlocks(
    workspace: VoxelMapWorkspace
  ): void {
    const next = this.order.apply(
      this._blocks,
      workspace.usage.stats.blocks
    );
    const shown = this._shownBlocks;
    if (
      next.length === shown.length &&
      next.every((block, index) => block === shown[index])
    ) {
      return;
    }

    this._shownBlocks = next;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-library": BlockLibrary;
  }
}
