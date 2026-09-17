// Import Third-party Dependencies
import {
  LitElement,
  html,
  css,
  nothing
} from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  type VoxelEngine,
  type ResolvedBlockDefinition,
  VoxelRotation
} from "@jolly-pixel/voxel.renderer";
import {
  showConfirm,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { BlockEditorDialog } from "./BlockEditorDialog.ts";
import {
  editorState,
  type BlockUsageStore,
  type BrushStore,
  type PresenceStore,
  type RotationMode,
  type TilesetStore,
  type WorldStore
} from "../../app/state/index.ts";
import { blocksWithoutTileset } from "../tilesets/blockTilesets.ts";
import {
  formatCount,
  orphanVoxelsMessage,
  removeBlockVoxels
} from "./blockUsage.ts";
import {
  DEFAULT_BLOCK_LIBRARY_ORDER,
  isReorderable,
  orderBlocks,
  type BlockLibraryOrder
} from "./blockLibraryOrder.ts";
import {
  mergeSelfPeerMark,
  selfPeerMark,
  type PeerMarkMap
} from "../../collaboration/peerMarks.ts";

// Registers the Three.js block grid.
import {
  BlockLibraryViewport,
  type BlockMoveDetail
} from "./BlockLibraryViewport.ts";

export type BlockLibraryLayout = "compact" | "fill";

export interface BlockSelectionChangeDetail {
  block: ResolvedBlockDefinition | null;
}

// CONSTANTS
const kMissingTileset = "Missing tileset";
const kRotationOptions: JollyOption<RotationMode>[] = [
  { label: "Auto", value: "auto" },
  { label: "0°", value: VoxelRotation.None },
  { label: "CCW 90°", value: VoxelRotation.CCW90 },
  { label: "180°", value: VoxelRotation.Deg180 },
  { label: "CW 90°", value: VoxelRotation.CW90 }
];

@customElement("block-library")
export class BlockLibrary extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      overflow: hidden;
    }

    :host([layout="compact"]) {
      min-height: 200px;
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

    .brush-row {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
    }

    .brush-row jolly-button-group {
      flex: 1 1 auto;
      min-width: 0;
    }

    .brush-row jolly-checkbox {
      --jolly-label-width: auto;
      --jolly-label-max-width: none;

      flex: 0 0 auto;
      margin-inline-start: auto;
    }
  `;

  @property({ attribute: false })
  declare engine: VoxelEngine | undefined;

  @property({ attribute: false })
  declare brush: BrushStore;

  @property({ attribute: false })
  declare worldStore: WorldStore;

  @property({ attribute: false })
  declare presence: PresenceStore;

  @property({ attribute: false })
  declare tilesets: TilesetStore;

  @property({ attribute: false })
  declare usage: BlockUsageStore;

  @property({ type: String })
  declare order: BlockLibraryOrder;

  @property({ type: String, reflect: true })
  declare layout: BlockLibraryLayout;

  @state()
  private declare _selectedId: number | null;

  @state()
  private declare _selectedBlock: ResolvedBlockDefinition | null;

  @state()
  private declare _blocks: ResolvedBlockDefinition[];

  @state()
  private declare _shownBlocks: ResolvedBlockDefinition[];

  @state()
  private declare _rotationMode: RotationMode;

  @state()
  private declare _flipY: boolean;

  @state()
  private declare _marks: PeerMarkMap<number>;

  @state()
  private declare _problems: ReadonlyMap<number, string>;

  @state()
  private declare _unused: ReadonlySet<number>;

  @query("block-editor-dialog")
  declare private _dialog: BlockEditorDialog;

  @query("block-library-viewport")
  declare private _viewport: BlockLibraryViewport | null;

  #subscriptions: Array<() => void> = [];

  constructor() {
    super();

    this.engine = undefined;
    this.brush = editorState.brush;
    this.worldStore = editorState.world;
    this.presence = editorState.presence;
    this.tilesets = editorState.tilesets;
    this.usage = editorState.usage;
    this.order = DEFAULT_BLOCK_LIBRARY_ORDER;
    this.layout = "compact";
    this._selectedId = null;
    this._selectedBlock = null;
    this._blocks = [];
    this._shownBlocks = [];
    this._rotationMode = this.brush.rotationMode;
    this._flipY = this.brush.flipY;
    this._marks = new Map();
    this._problems = new Map();
    this._unused = new Set();
  }

  readonly #onSelectedBlockChange = () => {
    this.#resolveSelection();
    void this.#revealSelection();
  };

  readonly #onBlockRegistryChanged = () => {
    if (this.engine) {
      this.#resolveSelection();
    }
    this.#refreshBlocks();
  };

  readonly #onRotationModeChange = () => {
    this._rotationMode = this.brush.rotationMode;
  };

  readonly #onFlipYChange = () => {
    this._flipY = this.brush.flipY;
  };

  readonly #onMarksChange = () => {
    this.#refreshMarks();
  };

  readonly #onTilesetsChange = () => {
    this.#refreshProblems();
  };

  readonly #onUsageChange = () => {
    this.#refreshUsage();
  };

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      this.brush.watch("blockChange", this.#onSelectedBlockChange),
      this.worldStore.watch("blockRegistryChanged", this.#onBlockRegistryChanged),
      this.brush.watch("rotationModeChange", this.#onRotationModeChange),
      this.brush.watch("flipYChange", this.#onFlipYChange),
      this.presence.watch("blockSelectionsChange", this.#onMarksChange),
      this.presence.watch("peersChange", this.#onMarksChange),
      this.tilesets.watch("change", this.#onTilesetsChange),
      this.usage.watch("change", this.#onUsageChange)
    );
    this.#refreshMarks();
    this.#refreshUsage();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  override willUpdate(
    changed: Map<string, unknown>
  ) {
    if (changed.has("engine") && this.engine) {
      this.#resolveSelection();
      this.#refreshBlocks();
    }
    else if (changed.has("order")) {
      this.#refreshShownBlocks();
      void this.#revealSelection();
    }
  }

  override render() {
    return html`
      ${this.#renderProblems()}
      ${this.#renderOrphans()}
      <block-library-viewport
        .engine=${this.engine}
        .blocks=${this._shownBlocks}
        .marks=${this._marks}
        .problems=${this._problems}
        .unused=${this._unused}
        .reorderable=${isReorderable(this.order)}
        .layout=${this.layout}
        @block-select=${this.#onBlockSelect}
        @block-edit=${this.#onBlockEdit}
        @block-move=${this.#onBlockMove}
        @block-create=${this.#onBlockCreate}
      ></block-library-viewport>

      <div class="brush-row">
        <jolly-button-group
          aria-label="Rotation"
          .options=${kRotationOptions}
          .value=${this._rotationMode}
          @jolly-change=${this.#onRotationChange}
        ></jolly-button-group>
        <jolly-checkbox
          align="end"
          label="Flip Y"
          .value=${this._flipY}
          @jolly-change=${this.#onFlipYToggle}
        ></jolly-checkbox>
      </div>

      <block-editor-dialog
        .engine=${this.engine}
        .brush=${this.brush}
        .tilesets=${this.tilesets}
        .usage=${this.usage}
        .block=${this._selectedBlock}
      ></block-editor-dialog>
    `;
  }

  #renderProblems() {
    const count = this._problems.size;
    if (count === 0) {
      return nothing;
    }

    const [firstId] = this._problems.keys();

    return html`
      <button
        type="button"
        class="problems"
        title="Select the first block without tileset"
        @click=${() => {
          this.brush.blockId = firstId;
        }}
      >
        <jolly-icon name="warning"></jolly-icon>
        <span>${count} block${count === 1 ? "" : "s"} without tileset</span>
      </button>
    `;
  }

  #renderOrphans() {
    const { orphanVoxels } = this.usage.stats;
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
    const { orphanVoxels, orphanBlocks } = this.usage.stats;
    if (!this.engine || orphanVoxels === 0) {
      return;
    }

    const confirmed = await showConfirm({
      title: "Remove orphan voxels",
      message: orphanVoxelsMessage(orphanVoxels, orphanBlocks),
      confirmLabel: "Remove",
      danger: true
    });
    if (confirmed) {
      removeBlockVoxels(this.engine.world, new Set(orphanBlocks));
    }
  }

  #onBlockSelect(
    event: CustomEvent<{ id: number; }>
  ): void {
    this.brush.blockId = event.detail.id;
  }

  #onBlockEdit(
    event: CustomEvent<{ id: number; }>
  ): void {
    this.brush.blockId = event.detail.id;
    void this.editBlock();
  }

  #onBlockMove(
    event: CustomEvent<BlockMoveDetail>
  ): void {
    this.engine?.moveBlock(event.detail.id, event.detail.toIndex);
  }

  #onBlockCreate(): void {
    void this.#addBlock();
  }

  #onRotationChange(
    event: CustomEvent<JollyChangeDetail<RotationMode>>
  ): void {
    this.brush.rotationMode = event.detail.value;
  }

  #onFlipYToggle(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    this.brush.flipY = event.detail.value;
  }

  async #addBlock(): Promise<void> {
    if (!this.engine) {
      return;
    }

    await this.updateComplete;
    await this._dialog?.openForCreate();
  }

  async editBlock(): Promise<void> {
    if (!this.engine || this._selectedBlock === null) {
      return;
    }

    await this.updateComplete;
    await this._dialog?.openForEdit();
  }

  async #revealSelection(): Promise<void> {
    const id = this._selectedId;
    if (id === null) {
      return;
    }

    await this.updateComplete;
    this._viewport?.revealBlock(id);
  }

  #refreshMarks(): void {
    this._marks = mergeSelfPeerMark(
      this.presence.blockSelections,
      this._selectedId,
      selfPeerMark(this.presence.peers)
    );
  }

  #resolveSelection(): void {
    this._selectedId = this.brush.blockId;
    this.#refreshMarks();
    const block = this.engine?.blockRegistry.get(this._selectedId ?? 0) ?? null;
    if (block === this._selectedBlock) {
      return;
    }

    this._selectedBlock = block;
    this.dispatchEvent(
      new CustomEvent<BlockSelectionChangeDetail>("block-selection-change", {
        detail: { block },
        bubbles: true,
        composed: true
      })
    );
  }

  #refreshBlocks(): void {
    if (!this.engine) {
      return;
    }

    this._blocks = [
      ...this.engine.blockRegistry.getAll()
    ];
    this.#refreshShownBlocks();
    this.#refreshProblems();
  }

  #refreshUsage(): void {
    const { unusedBlocks } = this.usage.stats;
    if (
      unusedBlocks.length !== this._unused.size ||
      unusedBlocks.some((id) => !this._unused.has(id))
    ) {
      this._unused = new Set(unusedBlocks);
    }
    this.#refreshShownBlocks();
    this.requestUpdate();
  }

  #refreshShownBlocks(): void {
    const next = orderBlocks(
      this._blocks,
      this.order,
      this.usage.stats.blocks
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

  #refreshProblems(): void {
    const missing = blocksWithoutTileset(this._blocks, this.tilesets.ids());

    this._problems = new Map(
      missing.map((block) => [block.id, kMissingTileset])
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-library": BlockLibrary;
  }
}
