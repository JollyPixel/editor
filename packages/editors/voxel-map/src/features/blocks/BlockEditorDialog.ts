// Import Third-party Dependencies
import {
  LitElement,
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
import type {
  BlockDefinition,
  ResolvedBlockDefinition,
  BlockShapeID,
  VoxelEngine
} from "@jolly-pixel/voxel.renderer";
import type {
  Dialog,
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  editorState,
  type BrushStore
} from "../../app/state/index.ts";

// CONSTANTS
const kDefaultBlockName = "New Block";

type BlockEditorMode = "edit" | "create";

interface BlockDraft {
  name: string;
  shapeId: BlockShapeID;
  tilesetId: string;
}

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
  declare engine: VoxelEngine | undefined;

  @property({ attribute: false })
  declare block: ResolvedBlockDefinition | null;
  @property({ attribute: false })
  declare brush: BrushStore;

  @state()
  private declare _mode: BlockEditorMode;

  @state()
  private declare _draft: BlockDraft;

  @query("jolly-dialog")
  declare private _dialog: Dialog;

  constructor() {
    super();

    this.engine = undefined;
    this.brush = editorState.brush;
    this.block = null;
    this._mode = "edit";
    this._draft = {
      name: kDefaultBlockName,
      shapeId: "cube",
      tilesetId: ""
    };
  }

  async openForEdit(): Promise<void> {
    if (!this.block) {
      return;
    }

    this._mode = "edit";
    await this.updateComplete;
    await this._dialog.showModal();
  }

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
    if (this._mode === "create") {
      return this.#renderDialog("New block", this._draft, true);
    }

    const { block } = this;
    if (!block) {
      return nothing;
    }

    return this.#renderDialog(
      `Block #${block.id}`,
      {
        name: block.name,
        shapeId: block.shapeId,
        tilesetId: block.defaultTexture?.tilesetId ?? this.#defaultTilesetId()
      },
      false
    );
  }

  #renderDialog(
    heading: string,
    values: BlockDraft,
    creating: boolean
  ) {
    return html`
      <jolly-dialog heading=${heading}>
        <div class="fields">
          <jolly-text
            label="Name"
            .value=${values.name}
            @jolly-change=${this.#onNameChange}
          ></jolly-text>
          <jolly-select
            label="Shape"
            .options=${this.#shapeOptions()}
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

  #defaultTilesetId(): string {
    return this.engine?.tilesetManager.defaultTilesetId ?? "";
  }

  #shapeOptions(): JollyOption<BlockShapeID>[] {
    if (!this.engine) {
      return [];
    }

    return [...this.engine.shapeRegistry.ids()].map((id) => {
      return { label: id, value: id };
    });
  }

  #tilesetOptions(): JollyOption<string>[] {
    const definitions = this.engine?.tilesetManager.definitions() ?? [];

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
    patch: Partial<ResolvedBlockDefinition>
  ): void {
    if (!this.block || !this.engine) {
      return;
    }

    const updated: ResolvedBlockDefinition = {
      ...this.block,
      ...patch
    };
    this.engine.defineBlock(updated);
    this.block = updated;
  }

  #confirmCreate(): void {
    if (!this.engine) {
      return;
    }

    const { blockRegistry } = this.engine;
    const definition: BlockDefinition = {
      id: blockRegistry.nextId,
      name: this._draft.name.trim() || kDefaultBlockName,
      shapeId: this._draft.shapeId,
      defaultTexture: {
        tilesetId: this._draft.tilesetId || undefined,
        col: 0,
        row: 0
      }
    };

    this.engine.defineBlock(definition);
    this.brush.blockId = definition.id;
    this.close();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-editor-dialog": BlockEditorDialog;
  }
}
