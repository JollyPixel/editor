// Import Third-party Dependencies
import { html, nothing } from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
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
import type { VoxelMapWorkspace } from "../../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../../workspace/WorkspaceElement.ts";
import {
  blockDialogStyles,
  MISSING_BLOCKSET,
  renderShapeColumn,
  shapeOptions,
  blocksetOptions
} from "./blockDialog.ts";
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
export class BlockEditDialog extends WorkspaceElement {
  static override styles = blockDialogStyles;

  @state()
  private declare _blockId: number | null;

  @state()
  private declare _open: boolean;

  @query("jolly-dialog")
  declare private _dialog: Dialog;

  constructor() {
    super();
    this._blockId = null;
    this._open = false;
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const refresh = (): void => {
      if (this._open) {
        this.requestUpdate();
      }
    };

    return [
      workspace.mapDocument.subscribe("blockRegistryChanged", refresh),
      workspace.usage.subscribe("change", refresh)
    ];
  }

  async open(
    blockId: number
  ): Promise<void> {
    if (this.workspace?.mapDocument.blocks.get(blockId) === undefined) {
      return;
    }

    this._blockId = blockId;
    this._open = true;
    await this.updateComplete;
    await this._dialog.showModal();
  }

  get #block(): ResolvedBlockDefinition | undefined {
    return this._blockId === null ?
      undefined :
      this.workspace?.mapDocument.blocks.get(this._blockId);
  }

  override render() {
    const workspace = this.workspace;
    const block = this.#block;
    if (workspace === null || block === undefined) {
      return nothing;
    }

    const { blocksets, view } = workspace;
    const owner = blocksets.findOwner(block.id);
    const blocksetId = owner?.definition.id ?? "";

    return html`
      <jolly-dialog
        heading=${block.name}
        heading-editable
        icon="blocks"
        @jolly-heading-change=${this.#onNameChange}
        @jolly-close=${this.#onClose}
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
            <jolly-select
              label="Shape"
              .options=${shapeOptions(view.shapes)}
              .value=${block.shapeId}
              @jolly-change=${this.#onShapeChange}
            ></jolly-select>
            ${this.#renderTransparency(block)}
            ${this.#renderUsage(workspace, block)}
          </div>
          ${renderShapeColumn({
            open: this._open,
            sources: workspace.blockSources,
            block,
            size: BlockTextures.fromBlock(block).size ?? blocksets.tileSizeFor(blocksetId),
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
    workspace: VoxelMapWorkspace,
    block: ResolvedBlockDefinition
  ) {
    if (!this._open) {
      return nothing;
    }

    const usage = workspace.usage.inspectUsage(block.id);

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

  #onShapeChange(
    event: CustomEvent<JollyChangeDetail<BlockShapeID>>
  ): void {
    this.#applyEdit({ shapeId: event.detail.value });
  }

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

  readonly #onSizeChange = (
    event: CustomEvent<JollyChangeDetail<number>>
  ): void => {
    const block = this.#block;
    if (block !== undefined) {
      this.workspace?.blocksets.defineBlock(
        BlockTextures.fromBlock(block).withTileSize(event.detail.value).createTexturedBlock(block)
      );
    }
  };

  #applyEdit(
    patch: Partial<ResolvedBlockDefinition>
  ): void {
    const block = this.#block;
    if (block !== undefined) {
      this.workspace?.blocksets.defineBlock({
        ...block,
        ...patch
      });
    }
  }

  async #confirmDelete(): Promise<void> {
    const workspace = this.workspace;
    const block = this.#block;
    if (workspace === null || block === undefined) {
      return;
    }

    const usage = workspace.usage.inspectUsage(block.id);
    const confirmed = usage.unused ||
      await this._dialog.confirmInline({
        message: `Delete "${block.name}"? ${usage.removalMessage}`,
        confirmLabel: "Delete",
        danger: true
      });
    if (!confirmed || !workspace.blocksets.removeBlock(block.id)) {
      return;
    }

    this.#close();
    const [next] = workspace.mapDocument.blocks.getAll();
    if (next !== undefined) {
      workspace.state.block.id = next.id;
    }
  }

  #onClose(): void {
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
