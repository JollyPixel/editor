// Import Third-party Dependencies
import { html, nothing } from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import {
  BlockTextures,
  cullsCoveredFaces,
  type BlockAlphaMode,
  type BlockShapeID,
  type BlockSide,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import {
  formatCount,
  type Dialog,
  type JollyChangeDetail,
  type JollyHeadingChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapEditing } from "../../../editing/VoxelMapEditing.ts";
import { EditingElement } from "../../../editing/EditingElement.ts";
import {
  blockDialogStyles,
  MISSING_BLOCKSET,
  renderShapeColumn,
  renderShapeSelect,
  blocksetOptions
} from "./blockDialog.ts";
import { ShapePreview } from "./ShapePreview.ts";
import type { PropertiesChangeDetail } from "../../../shared/properties/CustomPropertiesEditor.ts";
import "../../../shared/properties/CustomPropertiesEditor.ts";
import "../blockIcons.ts";

// CONSTANTS
const kAlphaModeOptions: JollyOption<BlockAlphaMode>[] = [
  { label: "Cutout", value: "mask" },
  { label: "Blended", value: "blend" }
];
const kSideOptions: JollyOption<BlockSide>[] = [
  { label: "Outside", value: "front" },
  { label: "Both", value: "double" }
];

@customElement("block-edit-dialog")
export class BlockEditDialog extends EditingElement {
  static override styles = blockDialogStyles;

  @state()
  private declare _blockId: number | null;

  @state()
  private declare _open: boolean;

  @query("jolly-dialog")
  declare private _dialog: Dialog;

  #shapePreview = new ShapePreview(this);

  constructor() {
    super();
    this._blockId = null;
    this._open = false;
  }

  protected override watchEditing(
    editing: VoxelMapEditing
  ): Iterable<() => void> {
    const refresh = (): void => {
      if (this._open) {
        this.requestUpdate();
      }
    };

    return [
      editing.editorMap.subscribe("blockRegistryChanged", refresh),
      editing.usage.subscribe("change", refresh)
    ];
  }

  async open(
    blockId: number
  ): Promise<void> {
    if (this.editing?.editorMap.blocks.get(blockId) === undefined) {
      return;
    }

    this._blockId = blockId;
    this._open = true;
    await this.updateComplete;
    await this._dialog.showModal();
    this.requestUpdate();
  }

  protected override shouldUpdate(): boolean {
    return this._dialog?.closing !== true;
  }

  get #block(): ResolvedBlockDefinition | undefined {
    return this._blockId === null ?
      undefined :
      this.editing?.editorMap.blocks.get(this._blockId);
  }

  override render() {
    const editing = this.editing;
    const block = this.#block;
    if (editing === null || block === undefined) {
      return nothing;
    }

    const { blocksets, view } = editing;
    const owner = blocksets.findOwner(block.id);
    const blocksetId = owner?.definition.id ?? "";

    return html`
      <jolly-dialog
        heading=${block.name}
        heading-editable
        icon="blocks"
        @jolly-heading-change=${this.#onNameChange}
        @jolly-exited=${this.#onExited}
      >
        <div class="layout">
          <div class="fields">
            <jolly-select
              label="Blockset"
              .options=${blocksetOptions(blocksets.entries, owner === undefined)}
              .value=${blocksetId}
              .error=${owner === undefined ? MISSING_BLOCKSET : null}
              disabled
            ></jolly-select>
            ${renderShapeSelect({
              shapes: view.shapes,
              value: block.shapeId,
              preview: this.#shapePreview,
              onChange: this.#onShapeChange
            })}
            ${this.#renderTransparency(block)}
            ${keyed(block.id, html`
              <custom-properties-editor
                .properties=${block.properties}
                @properties-change=${this.#onPropertiesChange}
              ></custom-properties-editor>
            `)}
            ${this.#renderUsage(editing, block)}
          </div>
          ${renderShapeColumn({
            open: this._open,
            stage: editing.previewStage,
            sources: editing.blockSources,
            block: this.#shapePreview.apply(block),
            size: BlockTextures.fromBlock(block).size ?? blocksets.blocksetTileSize(blocksetId),
            onSizeChange: this.#onSizeChange
          })}
        </div>

        <jolly-button
          slot="actions"
          variant="danger"
          icon="trash"
          @click=${this.#confirmDelete}
        >Delete</jolly-button>
        <jolly-button
          slot="actions"
          variant="accent"
          @click=${this.#close}
        >Close</jolly-button>
      </jolly-dialog>
    `;
  }

  #renderUsage(
    editing: VoxelMapEditing,
    block: ResolvedBlockDefinition
  ) {
    if (!this._open) {
      return nothing;
    }

    const usage = editing.usage.inspectUsage(block.id);

    return html`
      <jolly-separator label="Usage"></jolly-separator>
      <jolly-text
        class="usage-total"
        label="Placed"
        readonly
        .value=${usage.summary}
      ></jolly-text>
      ${usage.layers.map((layer) => html`
        <jolly-text
          class="usage-layer"
          label=${layer.layerName}
          readonly
          .value=${formatCount(layer.voxels, "voxel")}
        ></jolly-text>
      `)}
    `;
  }

  #renderTransparency(
    block: ResolvedBlockDefinition
  ) {
    const alphaMode = block.alphaMode ?? "opaque";
    if (alphaMode === "opaque") {
      return nothing;
    }

    return html`
      <jolly-separator label="Transparency"></jolly-separator>
      <jolly-button-group
        label="Alpha"
        description="Cutout keeps hard edges; Blended follows the tile pixels"
        description-display="tooltip"
        .options=${kAlphaModeOptions}
        .value=${alphaMode}
        @jolly-change=${this.#onAlphaModeChange}
      ></jolly-button-group>
      <jolly-button-group
        label="Sides"
        description="Both also draws the faces seen from inside the block"
        description-display="tooltip"
        .options=${kSideOptions}
        .value=${block.side ?? "double"}
        @jolly-change=${this.#onSideChange}
      ></jolly-button-group>
      <jolly-checkbox
        align="end"
        label="Cull faces"
        description="Drops the faces a neighbouring block covers"
        description-display="tooltip"
        .value=${cullsCoveredFaces(block)}
        @jolly-change=${this.#onCullCoveredFacesChange}
      ></jolly-checkbox>
    `;
  }

  #onNameChange(
    event: CustomEvent<JollyHeadingChangeDetail>
  ): void {
    this.#applyEdit({ name: event.detail.heading });
  }

  readonly #onShapeChange = (
    event: CustomEvent<JollyChangeDetail<BlockShapeID>>
  ): void => {
    this.#applyEdit({ shapeId: event.detail.value });
  };

  #onAlphaModeChange(
    event: CustomEvent<JollyChangeDetail<BlockAlphaMode>>
  ): void {
    this.#applyEdit({ alphaMode: event.detail.value });
  }

  #onSideChange(
    event: CustomEvent<JollyChangeDetail<BlockSide>>
  ): void {
    this.#applyEdit({ side: event.detail.value });
  }

  #onCullCoveredFacesChange(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    this.#applyEdit({ cullCoveredFaces: event.detail.value });
  }

  #onPropertiesChange(
    event: CustomEvent<PropertiesChangeDetail>
  ): void {
    this.#applyEdit({ properties: event.detail.properties });
  }

  readonly #onSizeChange = (
    event: CustomEvent<JollyChangeDetail<number>>
  ): void => {
    const block = this.#block;
    if (block !== undefined) {
      this.editing?.blocksets.defineBlock(
        BlockTextures.fromBlock(block).withTileSize(event.detail.value).createTexturedBlock(block)
      );
    }
  };

  #applyEdit(
    patch: Partial<ResolvedBlockDefinition>
  ): void {
    const block = this.#block;
    if (block !== undefined) {
      this.editing?.blocksets.defineBlock({
        ...block,
        ...patch
      });
    }
  }

  async #confirmDelete(): Promise<void> {
    const editing = this.editing;
    const block = this.#block;
    if (editing === null || block === undefined) {
      return;
    }

    const usage = editing.usage.inspectUsage(block.id);
    const confirmed = usage.unused ||
      await this._dialog.confirmInline({
        message: usage.deletePrompt(block.name),
        confirmLabel: "Delete",
        danger: true
      });
    if (!confirmed || !editing.blocksets.removeBlock(block.id)) {
      return;
    }

    this.#close();
  }

  #onExited(): void {
    this.#shapePreview.clear();
    this._open = false;
  }

  #close(): void {
    this._dialog?.close();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-edit-dialog": BlockEditDialog;
  }
}
