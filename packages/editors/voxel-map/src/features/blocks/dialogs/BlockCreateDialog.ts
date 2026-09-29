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
import { WorkspaceElement } from "../../../workspace/WorkspaceElement.ts";
import { BlockDraft } from "./BlockDraft.ts";
import {
  blockDialogStyles,
  renderShapeColumn,
  shapeOptions,
  tilesetOptions
} from "./blockDialog.ts";

@customElement("block-create-dialog")
export class BlockCreateDialog extends WorkspaceElement {
  static override styles = blockDialogStyles;

  @state()
  private declare _draft: BlockDraft;

  @state()
  private declare _open: boolean;

  @query("jolly-dialog")
  declare private _dialog: Dialog;

  #previewBlock: ResolvedBlockDefinition | null = null;

  constructor() {
    super();
    this._open = false;
    this._draft = BlockDraft.create("");
  }

  async open(): Promise<void> {
    this._draft = BlockDraft.create(
      this.workspace?.tilesets.activeTilesetId ?? ""
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
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    const { tilesets, view } = workspace;
    const draft = this._draft;

    return html`
      <jolly-dialog
        heading=${draft.name}
        heading-editable
        icon="blocks"
        @jolly-heading-change=${this.#onNameChange}
        @jolly-close=${this.#onClose}
      >
        <div class="layout">
          <div class="fields">
            <jolly-select
              label="Tileset"
              .options=${tilesetOptions(tilesets.entries, false)}
              .value=${draft.tilesetId}
              ?disabled=${tilesets.entries.length <= 1}
              @jolly-change=${this.#onTilesetChange}
            ></jolly-select>
            <jolly-select
              label="Shape"
              .options=${shapeOptions(view.shapes)}
              .value=${draft.shapeId}
              @jolly-change=${this.#onShapeChange}
            ></jolly-select>
          </div>
          ${renderShapeColumn({
            open: this._open,
            sources: workspace.blockSources,
            block: this.#previewBlock,
            size: draft.size ?? tilesets.tileSizeOf(draft.tilesetId),
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

  #onTilesetChange(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this._draft = this._draft.with({ tilesetId: event.detail.value });
  }

  #onShapeChange(
    event: CustomEvent<JollyChangeDetail<BlockShapeID>>
  ): void {
    this._draft = this._draft.with({ shapeId: event.detail.value });
  }

  readonly #onSizeChange = (
    event: CustomEvent<JollyChangeDetail<number>>
  ): void => {
    this._draft = this._draft.with({ size: event.detail.value });
  };

  #onClose(): void {
    this._open = false;
  }

  #close(): void {
    this._dialog?.close();
  }

  #create(): void {
    const workspace = this.workspace;
    const draft = this._draft;
    const id = workspace?.tilesets.nextBlockId(draft.tilesetId);
    if (workspace === null || id === undefined) {
      return;
    }

    const definition = draft.toDefinition(
      id,
      workspace.tilesets.freeTile(draft.tilesetId, draft.size)
    );
    workspace.tilesets.defineBlock(definition);
    workspace.state.brush.blockId = definition.id;
    this.#close();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-create-dialog": BlockCreateDialog;
  }
}
