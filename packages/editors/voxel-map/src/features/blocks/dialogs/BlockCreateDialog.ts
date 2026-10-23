// Import Third-party Dependencies
import { html, nothing } from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
import type {
  BlockShapeID,
  ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import type {
  Dialog,
  JollyChangeDetail,
  JollyHeadingChangeDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { EditingElement } from "../../../editing/EditingElement.ts";
import { BlockDraft } from "./BlockDraft.ts";
import {
  blockDialogStyles,
  renderShapeColumn,
  renderShapeSelect,
  blocksetOptions
} from "./blockDialog.ts";
import { ShapePreview } from "./ShapePreview.ts";
import "../blockIcons.ts";

@customElement("block-create-dialog")
export class BlockCreateDialog extends EditingElement {
  static override styles = blockDialogStyles;

  @state()
  private declare _draft: BlockDraft;

  @state()
  private declare _open: boolean;

  @query("jolly-dialog")
  declare private _dialog: Dialog;

  #previewBlock: ResolvedBlockDefinition | null = null;
  #shapePreview = new ShapePreview(this);

  constructor() {
    super();
    this._open = false;
    this._draft = BlockDraft.create("");
  }

  async open(): Promise<void> {
    const blocksets = this.editing?.blocksets;
    const writable = blocksets?.entriesGranting("blocks") ?? [];
    const active = blocksets?.activeBlocksetId ?? null;
    this._draft = BlockDraft.create(
      writable.find((entry) => entry.id === active)?.id ?? writable[0]?.id ?? ""
    );
    this._open = true;
    await this.updateComplete;
    await this._dialog.showModal();
  }

  override willUpdate(
    changed: Map<string, unknown>
  ): void {
    if (changed.has("_draft")) {
      this.#previewBlock = this._draft.preview();
    }
  }

  override render() {
    const editing = this.editing;
    if (editing === null) {
      return nothing;
    }

    const { blocksets, view } = editing;
    const draft = this._draft;
    const writable = blocksets.entriesGranting("blocks");

    return html`
      <jolly-dialog
        heading=${draft.name}
        heading-editable
        icon="blocks"
        @jolly-heading-change=${this.#onNameChange}
        @jolly-exited=${this.#onExited}
      >
        <div class="layout">
          <div class="fields">
            <jolly-select
              label="Blockset"
              .options=${blocksetOptions(writable, false)}
              .value=${draft.blocksetId}
              ?disabled=${writable.length <= 1}
              @jolly-change=${this.#onBlocksetChange}
            ></jolly-select>
            ${renderShapeSelect({
              shapes: view.shapes,
              value: draft.shapeId,
              preview: this.#shapePreview,
              onChange: this.#onShapeChange
            })}
          </div>
          ${renderShapeColumn({
            open: this._open,
            stage: editing.previewStage,
            sources: editing.blockSources,
            block: this.#shapePreview.apply(this.#previewBlock),
            size: draft.size ?? blocksets.blocksetTileSize(draft.blocksetId),
            onSizeChange: this.#onSizeChange
          })}
        </div>

        <jolly-button
          slot="actions"
          @click=${this.#close}
        >Cancel</jolly-button>
        <jolly-button
          slot="actions"
          variant="accent"
          @click=${this.#create}
        >Create</jolly-button>
      </jolly-dialog>
    `;
  }

  #onNameChange(
    event: CustomEvent<JollyHeadingChangeDetail>
  ): void {
    this._draft = this._draft.with({ name: event.detail.heading });
  }

  #onBlocksetChange(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this._draft = this._draft.with({ blocksetId: event.detail.value });
  }

  readonly #onShapeChange = (
    event: CustomEvent<JollyChangeDetail<BlockShapeID>>
  ): void => {
    this._draft = this._draft.with({ shapeId: event.detail.value });
  };

  readonly #onSizeChange = (
    event: CustomEvent<JollyChangeDetail<number>>
  ): void => {
    this._draft = this._draft.with({ size: event.detail.value });
  };

  #onExited(): void {
    this.#shapePreview.clear();
    this._open = false;
  }

  #close(): void {
    this._dialog?.close();
  }

  #create(): void {
    const editing = this.editing;
    const draft = this._draft;
    const id = editing?.blocksets.nextBlockId(draft.blocksetId);
    if (editing === null || id === undefined) {
      return;
    }

    const definition = draft.toDefinition(
      id,
      editing.blocksets.freeTile(draft.blocksetId, draft.size)
    );
    editing.blocksets.defineBlock(definition);
    editing.state.block.id = definition.id;
    this.#close();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-create-dialog": BlockCreateDialog;
  }
}
