// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type {
  BlockDefinition,
  BlockShapeID,
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer";
import type {
  Dialog,
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { applyBlockUpdate } from "../lib/applyBlockUpdate.ts";
import { BLOCK_SHAPE_OPTIONS } from "../lib/blockShapes.ts";
import {
  createBlockDefinition,
  nextBlockId
} from "../lib/blockDefaults.ts";
import { editorState } from "../EditorState.ts";

// CONSTANTS
const kDefaultBlockName = "New Block";

type BlockEditorMode = "edit" | "create";

interface BlockDraft {
  name: string;
  shapeId: BlockShapeID;
  tilesetId: string;
}

/**
 * Modal configuration for a block: name, shape and tileset. Tile coordinates
 * and transparency are owned by the paint tab, so they are absent here.
 *
 * In "edit" mode every field commits straight to the registry, keeping the
 * block preview live. In "create" mode the fields fill a draft that is
 * registered on confirmation.
 */
@customElement("block-editor-dialog")
export class BlockEditorDialog extends LitElement {
  static override styles = css`
    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      --jolly-label-width: 70px;
    }
  `;

  @property({ attribute: false })
  declare vr: VoxelRenderer | undefined;

  /** Live registry entry edited in "edit" mode. */
  @property({ attribute: false })
  declare block: BlockDefinition | null;

  @state()
  private declare _mode: BlockEditorMode;
  @state()
  private declare _draft: BlockDraft;

  @query("jolly-dialog")
  declare private _dialog: Dialog;

  constructor() {
    super();

    this.block = null;
    this._mode = "edit";
    this._draft = {
      name: kDefaultBlockName,
      shapeId: "cube",
      tilesetId: ""
    };
  }

  /** Configures the selected block. */
  async openForEdit(): Promise<void> {
    if (!this.block) {
      return;
    }

    this._mode = "edit";
    await this.updateComplete;
    await this._dialog.showModal();
  }

  /** Collects a new block definition, registered on confirmation. */
  async openForCreate(): Promise<void> {
    this._mode = "create";
    this._draft = {
      name: kDefaultBlockName,
      shapeId: "cube",
      tilesetId: this.#defaultTilesetId()
    };
    await this.updateComplete;
    await this._dialog.showModal();
  }

  close(): void {
    this._dialog?.close();
  }

  override render() {
    const creating = this._mode === "create";
    if (!creating && !this.block) {
      return nothing;
    }

    const values: BlockDraft = creating ?
      this._draft :
      {
        name: this.block!.name,
        shapeId: this.block!.shapeId,
        tilesetId: this.block!.defaultTexture?.tilesetId ?? this.#defaultTilesetId()
      };

    return html`
      <jolly-dialog heading=${this.#heading()}>
        <div class="fields">
          <jolly-text
            label="Name"
            .value=${values.name}
            @jolly-change=${this.#onNameChange}
          ></jolly-text>
          <jolly-select
            label="Shape"
            .options=${BLOCK_SHAPE_OPTIONS}
            .value=${values.shapeId}
            @jolly-change=${this.#onShapeChange}
          ></jolly-select>
          <jolly-select
            label="Tileset"
            .options=${this.#tilesetOptions()}
            .value=${values.tilesetId}
            @jolly-change=${this.#onTilesetChange}
          ></jolly-select>
        </div>

        ${creating ? html`
          <jolly-button
            slot="actions"
            @click=${this.close}
          >Cancel</jolly-button>
          <jolly-button
            slot="actions"
            variant="accent"
            @click=${this.#confirmCreate}
          >Create</jolly-button>
        ` : html`
          <jolly-button
            slot="actions"
            variant="accent"
            @click=${this.close}
          >Close</jolly-button>
        `}
      </jolly-dialog>
    `;
  }

  #heading(): string {
    if (this._mode === "create") {
      return "New block";
    }

    return `Block #${this.block!.id}`;
  }

  #defaultTilesetId(): string {
    return this.vr?.engine.tilesetManager.defaultTilesetId ?? "";
  }

  #tilesetOptions(): JollyOption<string>[] {
    const definitions = this.vr?.engine.tilesetManager.getDefinitions() ?? [];

    return definitions.map((def) => {
      return { label: def.id, value: def.id };
    });
  }

  #onNameChange(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    const name = event.detail.value.trim();
    if (!name) {
      return;
    }

    if (this._mode === "create") {
      this._draft = { ...this._draft, name };

      return;
    }

    this.#applyEdit({ name });
  }

  #onShapeChange(
    event: CustomEvent<JollyChangeDetail<BlockShapeID>>
  ): void {
    const shapeId = event.detail.value;
    if (this._mode === "create") {
      this._draft = { ...this._draft, shapeId };

      return;
    }

    this.#applyEdit({ shapeId });
  }

  #onTilesetChange(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    const tilesetId = event.detail.value;
    if (this._mode === "create") {
      this._draft = { ...this._draft, tilesetId };

      return;
    }

    if (!this.block) {
      return;
    }

    // A tileset switch restarts at the first tile; the paint tab moves the
    // UV region from there.
    this.#applyEdit({
      defaultTexture: {
        ...this.block.defaultTexture,
        tilesetId,
        col: 0,
        row: 0
      }
    });
  }

  #applyEdit(
    patch: Partial<BlockDefinition>
  ): void {
    if (!this.block || !this.vr) {
      return;
    }

    const updated: BlockDefinition = {
      ...this.block,
      ...patch
    };
    applyBlockUpdate(this.vr, updated);
    this.block = updated;
  }

  #confirmCreate(): void {
    if (!this.vr) {
      return;
    }

    const { blockRegistry } = this.vr.engine;
    const block = createBlockDefinition({
      id: nextBlockId(blockRegistry.getAll()),
      name: this._draft.name.trim() || kDefaultBlockName,
      shapeId: this._draft.shapeId,
      tilesetId: this._draft.tilesetId || undefined
    });

    blockRegistry.register(block);
    editorState.dispatchBlockRegistryChanged();
    editorState.setSelectedBlock(block.id);
    this.close();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-editor-dialog": BlockEditorDialog;
  }
}
