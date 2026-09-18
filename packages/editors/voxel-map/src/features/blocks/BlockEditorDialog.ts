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
import {
  cullsCoveredFaces,
  type ResolvedBlockDefinition,
  type BlockAlphaMode,
  type BlockSide,
  type BlockShapeID,
  type VoxelEngine
} from "@jolly-pixel/voxel.renderer";
import {
  Mixed,
  showConfirm,
  type Dialog,
  type JollyChangeDetail,
  type JollyHeadingChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  editorState,
  type BlockUsageStore,
  type BrushStore,
  type TilesetStore
} from "../../app/state/index.ts";
import {
  blockRemovalMessage,
  blockUsageSummary,
  formatCount
} from "./blockUsage.ts";
import {
  assignBlockTileset,
  blockTilesetStatus,
  blockTileSize,
  resizeBlockTiles,
  type TilesetGrid
} from "../tilesets/blockTilesets.ts";
import { tileSizeSegments } from "../tilesets/tileSizes.ts";
import {
  blockDefinitionFromDraft,
  previewBlockFromDraft,
  DEFAULT_BLOCK_NAME,
  type BlockDraft
} from "./blockDraft.ts";
import "./BlockShapePreview.ts";

// CONSTANTS
const kMissingTileset = "Missing tileset";
const kUvSizeColumns = 3;
const kAlphaModeOptions: JollyOption<BlockAlphaMode>[] = [
  { label: "Blended", value: "blend" },
  { label: "Cutout", value: "mask" }
];
const kSideOptions: JollyOption<BlockSide>[] = [
  { label: "Outside", value: "front" },
  { label: "Both", value: "double" }
];

type BlockEditorMode = "edit" | "create";

interface TextureFieldValues {
  tilesetId: string | typeof Mixed;
  size: number | undefined;
  missing: boolean;
}

@customElement("block-editor-dialog")
export class BlockEditorDialog extends LitElement {
  static override styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 200px;
      align-items: start;
      gap: var(--jolly-space-4, 16px);
    }

    @media (width <= 460px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }

      .shape {
        order: -1;
        width: 200px;
        justify-self: center;
      }
    }

    .fields,
    .shape {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);

      --jolly-label-width: 80px;
      --jolly-field-inset-start: 0;
      --jolly-field-inset-end: 0;
    }
  `;

  @property({ attribute: false })
  declare engine: VoxelEngine | undefined;

  @property({ attribute: false })
  declare block: ResolvedBlockDefinition | null;
  @property({ attribute: false })
  declare brush: BrushStore;

  @property({ attribute: false })
  declare tilesets: TilesetStore;

  @property({ attribute: false })
  declare usage: BlockUsageStore;

  @state()
  private declare _mode: BlockEditorMode;

  @state()
  private declare _draft: BlockDraft;

  @state()
  private declare _open: boolean;

  @query("jolly-dialog")
  declare private _dialog: Dialog;

  #previewDraft: BlockDraft | null = null;
  #previewDraftBlock: ResolvedBlockDefinition | null = null;
  #unwatchUsage: (() => void) | null = null;

  constructor() {
    super();

    this.engine = undefined;
    this.brush = editorState.brush;
    this.tilesets = editorState.tilesets;
    this.usage = editorState.usage;
    this.block = null;
    this._mode = "edit";
    this._open = false;
    this._draft = {
      name: DEFAULT_BLOCK_NAME,
      shapeId: "cube",
      tilesetId: ""
    };
  }

  async openForEdit(): Promise<void> {
    if (!this.block) {
      return;
    }

    this._mode = "edit";
    this._open = true;
    await this.updateComplete;
    await this._dialog.showModal();
  }

  async openForCreate(): Promise<void> {
    this._mode = "create";
    this._draft = {
      name: DEFAULT_BLOCK_NAME,
      shapeId: "cube",
      tilesetId: this.#defaultTilesetId()
    };
    this._open = true;
    await this.updateComplete;
    await this._dialog.showModal();
  }

  close(): void {
    this._dialog?.close();
  }

  override updated(
    changed: Map<string, unknown>
  ): void {
    if (!changed.has("_open") && !changed.has("usage")) {
      return;
    }

    this.#unwatchUsage?.();
    this.#unwatchUsage = this._open ?
      this.usage.watch("change", this.#onUsageChange) :
      null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatchUsage?.();
    this.#unwatchUsage = null;
  }

  readonly #onUsageChange = (): void => {
    this.requestUpdate();
  };

  override render() {
    if (this._mode === "create") {
      const { tilesetId, size } = this._draft;

      return this.#renderDialog(this._draft, {
        tilesetId,
        size: size ?? this.#tileSizeOf(tilesetId),
        missing: false
      }, true);
    }

    const { block } = this;
    if (!block) {
      return nothing;
    }

    return this.#renderDialog(
      {
        name: block.name,
        shapeId: block.shapeId,
        tilesetId: ""
      },
      this.#textureValuesOf(block),
      false
    );
  }

  #textureValuesOf(
    block: ResolvedBlockDefinition
  ): TextureFieldValues {
    const status = blockTilesetStatus(block, this.tilesets.ids());
    const tilesetId = status.kind === "assigned" ? status.tilesetId : "";

    return {
      tilesetId: status.kind === "mixed" ? Mixed : tilesetId,
      size: blockTileSize(block) ?? this.#tileSizeOf(tilesetId),
      missing: status.kind === "missing"
    };
  }

  #renderDialog(
    values: BlockDraft,
    texture: TextureFieldValues,
    creating: boolean
  ) {
    return html`
      <jolly-dialog
        heading=${values.name}
        heading-editable
        @jolly-heading-change=${this.#onNameChange}
        @jolly-close=${this.#onDialogClose}
      >
        <div class="layout">
          <div class="fields">
            <jolly-select
              label="Tileset"
              .options=${this.#tilesetOptions(texture.missing)}
              .value=${texture.tilesetId}
              .error=${texture.missing ? kMissingTileset : null}
              ?disabled=${this.#tilesetLocked(texture.missing)}
              @jolly-change=${this.#onTilesetChange}
            ></jolly-select>
            <jolly-select
              label="Shape"
              .options=${this.#shapeOptions()}
              .value=${values.shapeId}
              @jolly-change=${this.#onShapeChange}
            ></jolly-select>
            ${creating ? nothing : this.#renderTransparency()}
            ${creating ? nothing : this.#renderUsage()}
          </div>
          <div class="shape">
            ${this.#renderPreview(creating)}
            <jolly-button-group
              label="UV size"
              label-position="top"
              layout="grid"
              .columns=${kUvSizeColumns}
              .options=${tileSizeSegments(texture.size)}
              .value=${texture.size}
              ?disabled=${texture.size === undefined}
              @jolly-change=${this.#onSizeChange}
            ></jolly-button-group>
          </div>
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
            variant="danger"
            icon="trash"
            @click=${this.#confirmDelete}
          >Delete</jolly-button>
          <jolly-button
            slot="actions"
            variant="accent"
            @click=${this.close}
          >Close</jolly-button>
        `}
      </jolly-dialog>
    `;
  }

  #renderPreview(
    creating: boolean
  ) {
    if (!this._open) {
      return nothing;
    }

    return html`
      <block-shape-preview
        .engine=${this.engine}
        .block=${creating ? this.#draftPreviewBlock() : this.block}
      ></block-shape-preview>
    `;
  }

  #draftPreviewBlock(): ResolvedBlockDefinition {
    if (
      this.#previewDraftBlock === null ||
      this.#previewDraft !== this._draft
    ) {
      this.#previewDraft = this._draft;
      this.#previewDraftBlock = previewBlockFromDraft(this._draft);
    }

    return this.#previewDraftBlock;
  }

  #onDialogClose(): void {
    this._open = false;
  }

  #renderUsage() {
    const { block } = this;
    if (!block || !this._open) {
      return nothing;
    }

    const usage = this.usage.usageOf(block.id);

    return html`
      <jolly-separator label="Usage"></jolly-separator>
      <jolly-text
        class="usage-total"
        label="Placed"
        readonly
        .value=${blockUsageSummary(usage)}
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

  async #confirmDelete(): Promise<void> {
    const { block, engine } = this;
    if (!block || !engine) {
      return;
    }

    const confirmed = await showConfirm({
      title: `Delete "${block.name}"?`,
      message: blockRemovalMessage(this.usage.usageOf(block.id)),
      confirmLabel: "Delete",
      danger: true
    });
    if (!confirmed || !engine.removeBlock(block.id)) {
      return;
    }

    this.close();
    const [next] = engine.blockRegistry.getAll();
    if (next !== undefined) {
      this.brush.blockId = next.id;
    }
  }

  #renderTransparency() {
    const { block } = this;
    if (!block) {
      return nothing;
    }
    const alphaMode = block.alphaMode ?? "opaque";
    if (alphaMode === "opaque") {
      return nothing;
    }

    return html`
      <jolly-separator label="Transparency"></jolly-separator>
      <jolly-button-group
        label="Alpha"
        description="Blended follows the tile pixels; Cutout keeps hard edges"
        .options=${kAlphaModeOptions}
        .value=${alphaMode}
        @jolly-change=${this.#onAlphaModeChange}
      ></jolly-button-group>
      <jolly-button-group
        label="Sides"
        description="Both also draws the faces seen from inside the block"
        .options=${kSideOptions}
        .value=${block.side ?? "double"}
        @jolly-change=${this.#onSideChange}
      ></jolly-button-group>
      <jolly-checkbox
        align="end"
        label="Cull faces"
        description="Drops the faces a neighbouring block covers"
        .value=${cullsCoveredFaces(block)}
        @jolly-change=${this.#onCullCoveredFacesChange}
      ></jolly-checkbox>
    `;
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

  #defaultTilesetId(): string {
    return this.tilesets.activeTilesetId ??
      this.tilesets.firstTilesetId ??
      "";
  }

  #tileSizeOf(
    tilesetId: string
  ): number | undefined {
    return this.tilesets.entry(tilesetId)?.definition.tileSize;
  }

  #gridOf(
    tilesetId: string | undefined
  ): TilesetGrid | undefined {
    const tileSize = tilesetId === undefined ?
      undefined :
      this.#tileSizeOf(tilesetId);
    if (tilesetId === undefined || tileSize === undefined) {
      return undefined;
    }

    const atlas = this.engine?.tilesetManager.get(tilesetId)?.def;

    return {
      tileSize,
      width: atlas && atlas.cols * atlas.tileSize,
      height: atlas && atlas.rows * atlas.tileSize
    };
  }

  #shapeOptions(): JollyOption<BlockShapeID>[] {
    if (!this.engine) {
      return [];
    }

    return [...this.engine.shapeRegistry.ids()].map((id) => {
      return { label: id, value: id };
    });
  }

  #tilesetLocked(
    missing: boolean
  ): boolean {
    return !missing && this.tilesets.entries.length <= 1;
  }

  #tilesetOptions(
    missing: boolean
  ): JollyOption<string>[] {
    const options: JollyOption<string>[] = this.tilesets.entries.map((entry) => {
      return {
        label: entry.label,
        value: entry.definition.id
      };
    });
    if (missing) {
      options.unshift({
        label: kMissingTileset,
        value: "",
        disabled: true
      });
    }

    return options;
  }

  #onNameChange(
    event: CustomEvent<JollyHeadingChangeDetail>
  ): void {
    const { heading: name } = event.detail;
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

    const target = this.#gridOf(tilesetId);
    if (!this.block || target === undefined) {
      return;
    }

    this.#applyBlock(assignBlockTileset(this.block, {
      tilesetId,
      target,
      sourceOf: (id) => this.#gridOf(id)
    }));
  }

  #onSizeChange(
    event: CustomEvent<JollyChangeDetail<number>>
  ): void {
    const size = event.detail.value;
    if (this._mode === "create") {
      this._draft = { ...this._draft, size };

      return;
    }

    if (this.block) {
      this.#applyBlock(resizeBlockTiles(this.block, size));
    }
  }

  #applyEdit(
    patch: Partial<ResolvedBlockDefinition>
  ): void {
    if (this.block) {
      this.#applyBlock({
        ...this.block,
        ...patch
      });
    }
  }

  #applyBlock(
    updated: ResolvedBlockDefinition
  ): void {
    if (!this.engine) {
      return;
    }

    this.engine.defineBlock(updated);
    this.block = updated;
  }

  #confirmCreate(): void {
    if (!this.engine) {
      return;
    }

    const { blockRegistry } = this.engine;
    const definition = blockDefinitionFromDraft(
      this._draft,
      blockRegistry.nextId
    );

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
