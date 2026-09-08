// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  type VoxelEngine,
  type ResolvedBlockDefinition,
  VoxelRotation
} from "@jolly-pixel/voxel.renderer";
import type {
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
// Also registers the configuration modal element.
import { BlockEditorDialog } from "./BlockEditorDialog.ts";
import {
  editorState,
  type BrushStore,
  type RotationMode,
  type ShellStore,
  type WorldStore
} from "../../app/state/index.ts";
import {
  mergeSelfBlockMark,
  selfBlockMark,
  type BlockMarkMap
} from "./blockMarks.ts";

// Registers the Three.js block grid.
import "./BlockLibraryViewport.ts";

export type BlockLibraryLayout = "compact" | "fill";

export interface BlockSelectionChangeDetail {
  block: ResolvedBlockDefinition | null;
}

// CONSTANTS
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

    :host([layout="fill"]) block-library-viewport {
      flex: 1 1 auto;
      min-height: 0;
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
  declare shell: ShellStore;

  @property({ type: String, reflect: true })
  declare layout: BlockLibraryLayout;

  @state()
  private declare _selectedId: number | null;

  @state()
  private declare _selectedBlock: ResolvedBlockDefinition | null;

  @state()
  private declare _blocks: ResolvedBlockDefinition[];

  @state()
  private declare _rotationMode: RotationMode;

  @state()
  private declare _flipY: boolean;

  @state()
  private declare _marks: BlockMarkMap;

  @query("block-editor-dialog")
  declare private _dialog: BlockEditorDialog;

  #subscriptions: Array<() => void> = [];

  constructor() {
    super();

    this.engine = undefined;
    this.brush = editorState.brush;
    this.worldStore = editorState.world;
    this.shell = editorState.shell;
    this.layout = "compact";
    this._selectedId = null;
    this._selectedBlock = null;
    this._blocks = [];
    this._rotationMode = this.brush.rotationMode;
    this._flipY = this.brush.flipY;
    this._marks = new Map();
  }

  readonly #onSelectedBlockChange = () => {
    this.#resolveSelection();
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

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      this.brush.watch("blockChange", this.#onSelectedBlockChange),
      this.worldStore.watch("blockRegistryChanged", this.#onBlockRegistryChanged),
      this.brush.watch("rotationModeChange", this.#onRotationModeChange),
      this.brush.watch("flipYChange", this.#onFlipYChange),
      this.shell.watch("blockSelectionsChange", this.#onMarksChange),
      this.shell.watch("peersChange", this.#onMarksChange)
    );
    this.#refreshMarks();
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
  }

  override render() {
    return html`
      <block-library-viewport
        .engine=${this.engine}
        .blocks=${this._blocks}
        .marks=${this._marks}
        .layout=${this.layout}
        @block-select=${this.#onBlockSelect}
        @block-edit=${this.#onBlockEdit}
      ></block-library-viewport>

      <div class="brush-row">
        <jolly-button-group
          aria-label="Rotation"
          .options=${kRotationOptions}
          .value=${this._rotationMode}
          @jolly-change=${this.#onRotationChange}
        ></jolly-button-group>
        <jolly-checkbox
          label="Flip Y"
          .value=${this._flipY}
          @jolly-change=${this.#onFlipYToggle}
        ></jolly-checkbox>
      </div>

      <block-editor-dialog
        .engine=${this.engine}
        .brush=${this.brush}
        .block=${this._selectedBlock}
      ></block-editor-dialog>
    `;
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

  async addBlock(): Promise<void> {
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

  #refreshMarks(): void {
    this._marks = mergeSelfBlockMark(
      this.shell.blockSelections,
      this._selectedId,
      selfBlockMark(this.shell.peers)
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
    ].sort((a, b) => a.id - b.id);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-library": BlockLibrary;
  }
}
