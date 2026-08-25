// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  type VoxelRenderer,
  type BlockDefinition,
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
  type RotationMode
} from "../EditorState.ts";

// Registers the Three.js block grid.
import "./BlockLibraryViewport.ts";

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
  `;

  @property({ attribute: false })
  declare vr: VoxelRenderer;

  @state()
  private declare _selectedId: number | null;
  @state()
  private declare _selectedBlock: BlockDefinition | null;
  @state()
  private declare _blocks: BlockDefinition[];
  @state()
  private declare _rotationMode: RotationMode;
  @state()
  private declare _flipY: boolean;

  @query("block-editor-dialog")
  declare private _dialog: BlockEditorDialog;

  #subscriptions: Array<() => void> = [];

  constructor() {
    super();

    this._selectedId = null;
    this._selectedBlock = null;
    this._blocks = [];
    this._rotationMode = editorState.rotationMode;
    this._flipY = editorState.flipY;
  }

  readonly #onSelectedBlockChange = () => {
    this._selectedId = editorState.selectedBlockId;
    this._selectedBlock = this.vr?.engine.blockRegistry.get(this._selectedId ?? 0) ?? null;
  };

  readonly #onBlockRegistryChanged = () => {
    if (this.vr) {
      this._selectedId = editorState.selectedBlockId;
      this._selectedBlock = this.vr.engine.blockRegistry.get(this._selectedId ?? 0) ?? null;
    }
    this.#refreshBlocks();
  };

  readonly #onRotationModeChange = () => {
    this._rotationMode = editorState.rotationMode;
  };

  readonly #onFlipYChange = () => {
    this._flipY = editorState.flipY;
  };

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      editorState.on("selectedBlockChange", this.#onSelectedBlockChange),
      editorState.on("blockRegistryChanged", this.#onBlockRegistryChanged),
      editorState.on("rotationModeChange", this.#onRotationModeChange),
      editorState.on("flipYChange", this.#onFlipYChange)
    );
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
    if (changed.has("vr") && this.vr) {
      this._selectedId = editorState.selectedBlockId;
      this._selectedBlock = this.vr.engine.blockRegistry.get(this._selectedId) ?? null;
      this.#refreshBlocks();
    }
  }

  override render() {
    return html`
      <jolly-toolbar label="Block library">
        <jolly-button @click=${this.#addBlock}>+ Block</jolly-button>
        <jolly-button
          icon="pencil"
          icon-only
          label="Edit block"
          ?disabled=${this._selectedBlock === null}
          @click=${this.#editBlock}
        ></jolly-button>
      </jolly-toolbar>

      <block-library-viewport
        .vr=${this.vr}
        .blocks=${this._blocks}
        .selectedId=${this._selectedId}
        @block-select=${this.#onBlockSelect}
        @block-edit=${this.#onBlockEdit}
      ></block-library-viewport>

      <jolly-button-group
        label="Rotation"
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

      <block-editor-dialog
        .vr=${this.vr}
        .block=${this._selectedBlock}
      ></block-editor-dialog>
    `;
  }

  #onBlockSelect(
    event: CustomEvent<{ id: number; }>
  ): void {
    editorState.setSelectedBlock(event.detail.id);
  }

  #onBlockEdit(
    event: CustomEvent<{ id: number; }>
  ): void {
    editorState.setSelectedBlock(event.detail.id);
    void this.#editBlock();
  }

  #onRotationChange(
    event: CustomEvent<JollyChangeDetail<RotationMode>>
  ): void {
    editorState.setRotationMode(event.detail.value);
  }

  #onFlipYToggle(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    editorState.setFlipY(event.detail.value);
  }

  async #addBlock(): Promise<void> {
    if (!this.vr) {
      return;
    }

    await this.updateComplete;
    await this._dialog?.openForCreate();
  }

  /**
   * A selection made in the same tick has not reached the modal yet, so the
   * host settles before the dialog reads its block.
   */
  async #editBlock(): Promise<void> {
    if (!this.vr || this._selectedBlock === null) {
      return;
    }

    await this.updateComplete;
    await this._dialog?.openForEdit();
  }

  #refreshBlocks(): void {
    if (!this.vr) {
      return;
    }

    this._blocks = [
      ...this.vr.engine.blockRegistry.getAll()
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-library": BlockLibrary;
  }
}
