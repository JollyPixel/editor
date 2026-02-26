// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  type VoxelRenderer,
  type BlockDefinition,
  type BlockShapeID,
  VoxelRotation
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockLibraryRenderer } from "../lib/BlockLibraryRenderer.ts";
import {
  editorState,
  type RotationMode
} from "../EditorState.ts";
import type {
  EventInput,
  EventSelect
} from "./types.ts";

// CONSTANTS
const kRotationOptions: { label: string; value: RotationMode; }[] = [
  { label: "Auto", value: "auto" },
  { label: "0°", value: VoxelRotation.None },
  { label: "CCW 90°", value: VoxelRotation.CCW90 },
  { label: "180°", value: VoxelRotation.Deg180 },
  { label: "CW 90°", value: VoxelRotation.CW90 }
];

const kAllShapeIds: BlockShapeID[] = [
  "cube",
  "slabBottom",
  "slabTop",
  "poleY",
  "poleX",
  "ramp",
  "rampCornerInner",
  "rampCornerOuter",
  "stair",
  "stairCornerInner",
  "stairCornerOuter"
];

@customElement("block-library")
export class BlockLibrary extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .viewport-host {
      overflow-y: auto;
      background: #0e1316;
      cursor: pointer;
      min-height: 100px;
      max-height: 240px;
      overflow-x: hidden;
      padding: 5px;
    }
    .editor-section {
      padding: 8px;
      border-top: 1px solid #2a3540;
      font-size: 12px;
      color: #ccc;
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 5px;
    }
    label {
      min-width: 70px;
      color: #aaa;
    }
    select, input[type="text"], input[type="number"] {
      flex: 1;
      background: #111a20;
      border: 1px solid #333;
      color: #eee;
      padding: 3px 5px;
      border-radius: 3px;
      font-size: 12px;
    }
    input[type="number"] {
      width: 0;
    }
    .selected-info {
      font-size: 11px;
      color: #4488ff;
      margin-bottom: 5px;
    }
    .toolbar {
      display: flex;
      gap: 4px;
      padding: 4px 8px;
      background: #141a1d;
      border-bottom: 1px solid #2a3540;
    }
    .toolbar button {
      background: #2a3a4a;
      border: 1px solid #3a5060;
      color: #ccc;
      padding: 2px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    .toolbar button:hover {
      background: #3a5a7a;
    }
    .subsection-title {
      font-size: 10px;
      font-weight: 600;
      color: #667;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 8px 0 4px;
    }

    .rotation-bar {
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 4px 8px;
      background: #0e1316;
      border-top: 1px solid #1e2a30;
      border-bottom: 1px solid #1e2a30;
    }
    .rotation-bar span {
      font-size: 10px;
      font-weight: 600;
      color: #556;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-right: 4px;
      white-space: nowrap;
    }
    .rotation-bar button {
      background: #1a2228;
      border: 1px solid #2a3540;
      color: #888;
      padding: 2px 7px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      white-space: nowrap;
    }
    .rotation-bar button:hover {
      background: #243040;
      color: #ccc;
    }
    .rotation-bar button.active {
      background: #1a3a5a;
      border-color: #4488ff;
      color: #4488ff;
    }
  `;

  @property({ attribute: false }) declare vr: VoxelRenderer;

  @state() private declare _selectedId: number | null;
  @state() private declare _selectedBlock: BlockDefinition | null;
  @state() private declare _rotationMode: RotationMode;

  constructor() {
    super();

    this._selectedId = null;
    this._selectedBlock = null;
    this._rotationMode = editorState.rotationMode;
  }

  #renderer: BlockLibraryRenderer | null = null;
  #viewportHost: HTMLDivElement | null = null;

  readonly #onSelectedBlockChange = () => {
    this._selectedId = editorState.selectedBlockId;
    this.#renderer?.setSelectedBlock(this._selectedId);
    this._selectedBlock = this.vr?.blockRegistry.get(this._selectedId ?? 0) ?? null;
  };

  readonly #onBlockRegistryChanged = () => {
    if (this.vr) {
      this._selectedId = editorState.selectedBlockId;
      this._selectedBlock = this.vr.blockRegistry.get(this._selectedId ?? 0) ?? null;
    }
    this.#buildRenderer();
  };

  readonly #onRotationModeChange = () => {
    this._rotationMode = editorState.rotationMode;
  };

  override firstUpdated() {
    this.#viewportHost = this.shadowRoot!.querySelector<HTMLDivElement>(".viewport-host")!;

    editorState.addEventListener("selectedBlockChange", this.#onSelectedBlockChange);
    editorState.addEventListener("blockRegistryChanged", this.#onBlockRegistryChanged);
    editorState.addEventListener("rotationModeChange", this.#onRotationModeChange);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    editorState.removeEventListener("selectedBlockChange", this.#onSelectedBlockChange);
    editorState.removeEventListener("blockRegistryChanged", this.#onBlockRegistryChanged);
    editorState.removeEventListener("rotationModeChange", this.#onRotationModeChange);
    this.#renderer?.dispose();
    this.#renderer = null;
  }

  override willUpdate(
    changed: Map<string, unknown>
  ) {
    if (changed.has("vr") && this.vr) {
      this._selectedId = editorState.selectedBlockId;
      this._selectedBlock = this.vr.blockRegistry.get(this._selectedId) ?? null;
    }
  }

  override updated(
    changed: Map<string, unknown>
  ) {
    if (changed.has("vr") && this.vr && this.#viewportHost) {
      this.#buildRenderer();
    }
  }

  #buildRenderer(): void {
    if (!this.vr || !this.#viewportHost) {
      return;
    }

    this.#renderer?.dispose();
    const blocks = [...this.vr.blockRegistry.getAll()];
    this.#renderer = new BlockLibraryRenderer(this.#viewportHost, {
      shapeRegistry: this.vr.shapeRegistry,
      tilesetManager: this.vr.tilesetManager,
      blocks
    });
    this.#renderer.setSelectedBlock(this._selectedId);
  }

  override render() {
    const tilesetDefs = this.vr?.tilesetManager.getDefinitions() ?? [];
    const currentTilesetId =
      this._selectedBlock?.defaultTexture?.tilesetId ??
      this.vr?.tilesetManager.defaultTilesetId ??
      null;
    const currentCol = this._selectedBlock?.defaultTexture?.col ?? 0;
    const currentRow = this._selectedBlock?.defaultTexture?.row ?? 0;

    return html`
      <div class="toolbar">
        <button @click=${this.#addBlock}>+ Block</button>
        <button
          @click=${this.#removeBlock}
          ?disabled=${this._selectedId === null}
        >- Remove</button>
      </div>

      <div
        class="viewport-host"
        @click=${this.#onViewportClick}
      ></div>

      <div class="rotation-bar">
        <span>Rotation</span>
        ${kRotationOptions.map(({ label, value }) => html`
          <button
            class=${this._rotationMode === value ? "active" : ""}
            @click=${() => editorState.setRotationMode(value)}
          >${label}</button>
        `)}
      </div>

      ${this._selectedBlock
          ? html`
          <div class="editor-section">
            <div class="selected-info">Block #${this._selectedBlock.id}: ${this._selectedBlock.name}</div>

            <div class="row">
              <label>Name</label>
              <input
                type="text"
                .value=${this._selectedBlock.name}
                @change=${(event: EventInput) => this.#renameBlock(event.target.value)}
              />
            </div>

            <div class="row">
              <label>Shape</label>
              <select @change=${this.#onShapeChange}>
                ${kAllShapeIds.map((id) => html`
                  <option
                    value=${id}
                    ?selected=${this._selectedBlock!.shapeId === id}
                  >${id}</option>
                `)}
              </select>
            </div>

            <div class="subsection-title">Texture</div>

            <div class="row">
              <label>Tileset</label>
              <select @change=${this.#onTilesetChange}>
                ${tilesetDefs.map((def) => html`
                  <option
                    value=${def.id}
                    ?selected=${currentTilesetId === def.id}
                  >${def.id}</option>
                `)}
              </select>
            </div>

            <div class="row">
              <label>Col</label>
              <input
                type="number"
                min="0"
                .value=${String(currentCol)}
                @change=${this.#onColChange}
              />
            </div>

            <div class="row">
              <label>Row</label>
              <input
                type="number"
                min="0"
                .value=${String(currentRow)}
                @change=${this.#onRowChange}
              />
            </div>
          </div>
        `
          : null
      }
    `;
  }

  #onViewportClick(
    event: MouseEvent
  ): void {
    if (!this.#renderer || !this.#viewportHost) {
      return;
    }
    const rect = this.#renderer.canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const blockId = this.#renderer.getBlockAtPointer(px, py);
    if (blockId !== null) {
      editorState.setSelectedBlock(blockId);
    }
  }

  #addBlock(): void {
    if (!this.vr) {
      return;
    }

    // eslint-disable-next-line no-alert
    const name = prompt("Block name:", "New Block");
    if (!name?.trim()) {
      return;
    }
    const existingIds = [...this.vr.blockRegistry.getAll()].map((b) => b.id);
    const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    const defaultTilesetId = this.vr.tilesetManager.defaultTilesetId ?? undefined;
    this.vr.blockRegistry.register({
      id: newId,
      name: name.trim(),
      shapeId: "cube",
      collidable: true,
      faceTextures: {},
      defaultTexture: { tilesetId: defaultTilesetId, col: 0, row: 0 }
    });
    this.#refreshRenderer();
  }

  #removeBlock(): void {
    if (this._selectedId === null || !this.vr) {
      return;
    }

    // BlockRegistry has no remove API — just rebuild the display without it.
    // The block remains in registry (safe for existing voxels) but won't show.
    this._selectedId = null;
    this._selectedBlock = null;
  }

  #renameBlock(
    newName: string
  ): void {
    if (!this._selectedBlock || !this.vr || !newName.trim()) {
      return;
    }

    this.#applyBlockUpdate({
      ...this._selectedBlock,
      name: newName.trim()
    });
  }

  #onShapeChange(
    event: EventSelect
  ): void {
    if (!this._selectedBlock || !this.vr) {
      return;
    }

    const shapeId = event.target.value as BlockShapeID;
    this.#applyBlockUpdate({
      ...this._selectedBlock,
      shapeId
    });
  }

  #onTilesetChange(
    event: EventSelect
  ): void {
    if (!this._selectedBlock || !this.vr) {
      return;
    }

    const tilesetId = event.target.value;
    this.#applyBlockUpdate({
      ...this._selectedBlock,
      defaultTexture: {
        ...this._selectedBlock.defaultTexture,
        tilesetId,
        col: 0,
        row: 0
      }
    });
  }

  #onColChange(
    event: EventInput
  ): void {
    if (!this._selectedBlock || !this.vr) {
      return;
    }

    const col = Math.max(0, parseInt(event.target.value, 10) || 0);
    this.#applyBlockUpdate({
      ...this._selectedBlock,
      defaultTexture: { ...this._selectedBlock.defaultTexture!, col }
    });
  }

  #onRowChange(
    event: EventInput
  ): void {
    if (!this._selectedBlock || !this.vr) {
      return;
    }

    const row = Math.max(0, parseInt(event.target.value, 10) || 0);
    this.#applyBlockUpdate({
      ...this._selectedBlock,
      defaultTexture: {
        ...this._selectedBlock.defaultTexture!,
        row
      }
    });
  }

  /**
   * Registers the updated definition, rebuilds placed voxels in the scene,
   * and refreshes the preview grid. All block mutations route through here.
   */
  #applyBlockUpdate(
    updated: BlockDefinition
  ): void {
    this.vr.blockRegistry.register(updated);
    this._selectedBlock = updated;
    this.vr.markAllChunksDirty("BlockLibrary update");
    this.#refreshRenderer();
  }

  #refreshRenderer(): void {
    if (!this.vr || !this.#renderer) {
      return;
    }

    const blocks = [...this.vr.blockRegistry.getAll()];
    this.#renderer.setBlocks(blocks);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-library": BlockLibrary;
  }
}
