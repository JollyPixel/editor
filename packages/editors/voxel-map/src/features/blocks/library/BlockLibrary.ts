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
  ContextMenuController,
  LazyTemplate,
  MenuSession,
  formatCount,
  showConfirm,
  type ContextMenu
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapEditing } from "../../../editing/VoxelMapEditing.ts";
import { EditingElement } from "../../../editing/EditingElement.ts";
import { BlockUsage } from "../usage/BlockUsage.ts";
import { BlockLibraryView } from "./BlockLibraryView.ts";
import { ShownBlocks } from "./ShownBlocks.ts";
import {
  BlockMenu,
  LIBRARY_MENU,
  type BlockCommand
} from "./BlockMenu.ts";
import { PeerMarks } from "./PeerMarks.ts";
import type { MaterialSwatch } from "../../materials/MaterialSwatch.ts";
import type {
  BlockContextDetail,
  BlockLibraryViewport
} from "./BlockLibraryViewport.ts";
import type { BlockMoveDetail } from "./BlockReorderController.ts";
import "./BlockLibraryViewport.ts";
import "../blockIcons.ts";

export type BlockLibraryLayout = "compact" | "fill";

@customElement("block-library")
export class BlockLibrary extends EditingElement {
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

    block-create-dialog,
    block-edit-dialog {
      position: absolute;
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

    .no-matches {
      flex: 0 0 auto;
      margin: 0;
      padding: var(--jolly-space-1, 4px);
      color: var(--jolly-text-muted);
      text-align: center;
    }
  `;

  @property({ attribute: false })
  declare view: BlockLibraryView;

  @property({ type: Boolean })
  declare editable: boolean;

  @property({ type: String, reflect: true })
  declare layout: BlockLibraryLayout;

  @state()
  private declare _selectedId: number | null;

  @state()
  private declare _shown: ShownBlocks;

  @state()
  private declare _marks: PeerMarks<number>;

  @state()
  private declare _unused: ReadonlySet<number>;

  @state()
  private declare _swatches: ReadonlyMap<number, MaterialSwatch>;

  @query("block-library-viewport")
  declare private _viewport: BlockLibraryViewport | null;

  @query("jolly-context-menu")
  declare private _contextMenu: ContextMenu;

  #menu = new ContextMenuController(
    () => this._contextMenu,
    () => MenuSession.EMPTY
  );
  #dialogs = new LazyTemplate(this, () => Promise.all([
    import("../dialogs/BlockCreateDialog.ts"),
    import("../dialogs/BlockEditDialog.ts")
  ]));

  constructor() {
    super();

    this.view = BlockLibraryView.Default;
    this.layout = "compact";
    this.editable = true;
    this._selectedId = null;
    this._shown = ShownBlocks.Empty;
    this._marks = new PeerMarks();
    this._unused = new Set();
    this._swatches = new Map();
  }

  protected override watchEditing(
    editing: VoxelMapEditing
  ): Iterable<() => void> {
    const { block, presence } = editing.state;
    const refreshMarks = (): void => this.#refreshMarks(editing);
    const refreshSwatches = (): void => this.#refreshSwatches(editing);
    this.#resolveSelection(editing);
    this.#refreshBlocks(editing);
    this.#refreshUsage(editing);
    this.#refreshSwatches(editing);

    return [
      block.subscribe("change", () => {
        this.#resolveSelection(editing);
        void this.#revealSelection();
      }),
      editing.editorMap.subscribe("blockRegistryChanged", () => {
        this.#resolveSelection(editing);
        this.#refreshBlocks(editing);
        refreshSwatches();
      }),
      editing.editorMap.subscribe("materialGroupsChanged", refreshSwatches),
      presence.subscribe("blockSelectionsChange", refreshMarks),
      presence.subscribe("peersChange", refreshMarks),
      editing.blocksets.subscribe("change", () => {
        this.#refreshShownBlocks(editing);
        this.requestUpdate();
      }),
      editing.blocksets.subscribe("activeChange", () => {
        this.#refreshShownBlocks(editing);
        void this.#revealSelection();
      }),
      editing.access.subscribe("change", () => this.requestUpdate()),
      editing.usage.subscribe("change", () => this.#refreshUsage(editing))
    ];
  }

  override willUpdate(
    changed: Map<string, unknown>
  ) {
    const editing = this.editing;
    if (changed.has("view") && editing !== null) {
      this.#refreshShownBlocks(editing);
      void this.#revealSelection();
    }
  }

  override render() {
    const editing = this.editing;
    if (editing === null) {
      return nothing;
    }

    const creatable = this.#creatable(editing);
    const cleanable = this.editable && editing.access.current.has("voxels");

    return html`
      ${cleanable ? this.#renderOrphans(editing) : nothing}
      ${this.#renderNoMatches()}
      <block-library-viewport
        .stage=${editing.previewStage}
        .sources=${editing.blockSources}
        .blocks=${this._shown.blocks}
        .marks=${this._marks}
        .selectedId=${this._selectedId}
        .unused=${this._unused}
        .swatches=${this._swatches}
        .editable=${creatable}
        .reorderable=${creatable && this.view.order.reorderable}
        .layout=${this.layout}
        @block-select=${this.#onBlockSelect}
        @block-edit=${this.#onBlockEdit}
        @block-move=${this.#onBlockMove}
        @block-create=${this.#onBlockCreate}
        @block-context=${this.#onBlockContext}
      ></block-library-viewport>
      <jolly-context-menu
        label="Block actions"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>

      <slot></slot>

      ${creatable ? this.#dialogs.render(() => html`
        <block-create-dialog .editing=${editing}></block-create-dialog>
        <block-edit-dialog .editing=${editing}></block-edit-dialog>
      `) : nothing}
    `;
  }

  #renderNoMatches() {
    if (this.view.search.isEmpty || this._shown.blocks.length > 0) {
      return nothing;
    }

    return html`<p class="no-matches" role="status">No matching blocks</p>`;
  }

  #renderOrphans(
    editing: VoxelMapEditing
  ) {
    const { orphanVoxels } = editing.usage.stats;
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
    const editing = this.editing;
    if (editing === null || editing.usage.stats.orphanVoxels === 0) {
      return;
    }

    const { orphanVoxels, orphanBlocks } = editing.usage.stats;

    const confirmed = await showConfirm({
      title: "Remove orphan voxels",
      message: BlockUsage.orphanMessage(orphanVoxels, orphanBlocks),
      confirmLabel: "Remove",
      icon: "trash",
      danger: true
    });
    if (confirmed) {
      editing.editorMap.world.removeBlocks(orphanBlocks);
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
    void this.#editBlock();
  }

  #onBlockMove(
    event: CustomEvent<BlockMoveDetail>
  ): void {
    this.editing?.blocksets.moveBlock(
      event.detail.id,
      this._shown.registryIndex(event.detail)
    );
  }

  #onBlockCreate(): void {
    void this.#createBlock();
  }

  async #createBlock(): Promise<void> {
    const dialog = await this.#dialogs.query("block-create-dialog");
    await dialog.open();
  }

  #creatable(
    editing: VoxelMapEditing
  ): boolean {
    return this.editable &&
      editing.blocksets.entriesGranting("blocks").length > 0;
  }

  #onBlockContext(
    event: CustomEvent<BlockContextDetail>
  ): void {
    const editing = this.editing;
    if (editing === null) {
      return;
    }

    const { id, x, y } = event.detail;
    const session = id === null ?
      this.#libraryMenu(editing) :
      this.#blockMenu(editing, id);
    if (session === null) {
      return;
    }

    event.preventDefault();
    if (id !== null) {
      editing.state.block.id = id;
    }
    this.#menu.open(session, { x, y });
  }

  #libraryMenu(
    editing: VoxelMapEditing
  ): MenuSession | null {
    return this.#creatable(editing) ?
      MenuSession.from(LIBRARY_MENU, () => this.#createBlock()) :
      null;
  }

  #blockMenu(
    editing: VoxelMapEditing,
    blockId: number
  ): MenuSession {
    const { editorMap, blocksets, materials, usage, access } = editing;
    const menu = new BlockMenu({
      blockId,
      materials: materials.availableTo(blockId),
      editable: blocksets.canEditBlock(blockId),
      clearable: access.current.has("voxels") &&
        !usage.inspectUsage(blockId).unused
    });

    return menu.session(this.editable ? "blocks" : "materials", {
      exists: () => editorMap.blocks.has(blockId),
      run: (command) => this.#runCommand(editing, command, blockId),
      assign: (material) => materials.assign(blockId, material.id)
    });
  }

  async #runCommand(
    editing: VoxelMapEditing,
    command: BlockCommand,
    blockId: number
  ): Promise<void> {
    switch (command) {
      case "edit":
        await this.#editBlock(blockId);
        break;
      case "duplicate":
        this.#duplicate(editing, blockId);
        break;
      case "new-material":
        editing.materials.createForBlock(blockId);
        break;
      case "remove-material":
        editing.materials.assign(blockId, null);
        break;
      case "copy-id":
        await navigator.clipboard.writeText(String(blockId));
        break;
      case "remove-voxels":
        await this.#confirmRemoveVoxels(editing, blockId);
        break;
      case "delete":
        await this.#confirmDelete(editing, blockId);
        break;
    }
  }

  #duplicate(
    editing: VoxelMapEditing,
    blockId: number
  ): void {
    const copyId = editing.blocksets.duplicateBlock(blockId);
    if (copyId !== null) {
      editing.state.block.id = copyId;
    }
  }

  async #confirmRemoveVoxels(
    editing: VoxelMapEditing,
    blockId: number
  ): Promise<void> {
    const block = editing.editorMap.blocks.get(blockId);
    const usage = editing.usage.inspectUsage(blockId);
    if (block === undefined || usage.unused) {
      return;
    }

    const confirmed = await showConfirm({
      title: "Remove voxels",
      message: usage.clearPrompt(block.name),
      confirmLabel: "Remove",
      icon: "eraser",
      danger: true
    });
    if (confirmed) {
      editing.editorMap.world.removeBlocks([blockId]);
    }
  }

  async #confirmDelete(
    editing: VoxelMapEditing,
    blockId: number
  ): Promise<void> {
    const block = editing.editorMap.blocks.get(blockId);
    if (block === undefined) {
      return;
    }

    const usage = editing.usage.inspectUsage(blockId);
    const confirmed = usage.unused || await showConfirm({
      title: "Delete block",
      message: usage.deletePrompt(block.name),
      confirmLabel: "Delete",
      icon: "trash",
      danger: true
    });
    if (confirmed) {
      editing.blocksets.removeBlock(blockId);
    }
  }

  async #editBlock(
    id = this._selectedId
  ): Promise<void> {
    const editing = this.editing;
    if (
      id === null ||
      editing === null ||
      !this.#creatable(editing) ||
      !editing.blocksets.canEditBlock(id)
    ) {
      return;
    }

    const dialog = await this.#dialogs.query("block-edit-dialog");
    await dialog.open(id);
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
    editing: VoxelMapEditing
  ): void {
    const { presence } = editing.state;
    this._marks = PeerMarks.withSelf(
      presence.blockSelections,
      this._selectedId,
      presence.peers
    );
  }

  #resolveSelection(
    editing: VoxelMapEditing
  ): void {
    this._selectedId = editing.state.block.id;
    this.#refreshMarks(editing);
  }

  #refreshBlocks(
    editing: VoxelMapEditing
  ): void {
    this.#showBlocks(editing, [...editing.editorMap.blocks.getAll()]);
  }

  #refreshUsage(
    editing: VoxelMapEditing
  ): void {
    const { unusedBlocks } = editing.usage.stats;
    if (
      unusedBlocks.length !== this._unused.size ||
      unusedBlocks.some((id) => !this._unused.has(id))
    ) {
      this._unused = new Set(unusedBlocks);
    }
    this.#refreshShownBlocks(editing);
    this.requestUpdate();
  }

  #refreshSwatches(
    editing: VoxelMapEditing
  ): void {
    this._swatches = editing.materials.swatches();
  }

  #refreshShownBlocks(
    editing: VoxelMapEditing
  ): void {
    this.#showBlocks(editing, this._shown.registry);
  }

  #showBlocks(
    editing: VoxelMapEditing,
    registry: readonly ResolvedBlockDefinition[]
  ): void {
    this._shown = this._shown.update(
      registry,
      this.view.apply(
        registry,
        editing.blocksets.active,
        editing.usage.stats.blocks
      )
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-library": BlockLibrary;
  }
}
