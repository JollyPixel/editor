// Import Third-party Dependencies
import {
  html,
  css,
  nothing
} from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
import type {
  Dialog,
  JollyChangeDetail
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/button-group";
import "@jolly-pixel/ui/elements/dialog";
import "@jolly-pixel/ui/elements/icon";
import "@jolly-pixel/ui/elements/text";
import { BlockTextures } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelMapEditing } from "../../../editing/VoxelMapEditing.ts";
import { EditingElement } from "../../../editing/EditingElement.ts";
import type { BlocksetEntry } from "../BlocksetEntry.ts";
import { tileSizeSegments } from "../tileSizes.ts";
import "../blocksetIcons.ts";

// CONSTANTS
const kOffGridWarning = "Some blocks will not line up with the new tile " +
  "grid. They keep covering the same pixels.";

@customElement("blockset-edit-dialog")
export class BlocksetEditDialog extends EditingElement {
  static override styles = css`
    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);

      --jolly-label-width: 80px;
      --jolly-field-inset-end: 0px;
    }

    .usage {
      margin: var(--jolly-space-2, 8px) 0 0;
      color: var(--jolly-text-muted);
      font-size: var(--jolly-font-size-sm, 12px);
    }

    .remove {
      margin-inline-end: auto;
    }

    .pending {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: var(--jolly-space-2, 8px);
      padding: var(--jolly-space-2, 8px);
      border-radius: var(--jolly-radius-sm, 2px);
      background: color-mix(
        in oklab,
        var(--jolly-intent-warning-fill) 16%,
        transparent
      );
    }

    .pending p {
      flex: 1 1 24ch;
      margin: 0;
      line-height: 1.4;
    }
  `;

  @state()
  private declare _blocksetId: string | null;

  @state()
  private declare _pendingTileSize: number | null;

  @query("jolly-dialog")
  private declare _dialog: Dialog;

  constructor() {
    super();
    this._blocksetId = null;
    this._pendingTileSize = null;
  }

  protected override watchEditing(
    editing: VoxelMapEditing
  ): Iterable<() => void> {
    return [
      editing.blocksets.subscribe("change", this.#refresh),
      editing.editorMap.subscribe("blockRegistryChanged", this.#refresh),
      editing.usage.subscribe("change", this.#refresh),
      editing.access.subscribe("change", this.#refresh)
    ];
  }

  async open(
    blocksetId: string
  ): Promise<void> {
    if (this.editing?.blocksets.entry(blocksetId) === undefined) {
      return;
    }

    this._blocksetId = blocksetId;
    await this.updateComplete;
    await this._dialog.showModal();
    this.requestUpdate();
  }

  protected override shouldUpdate(): boolean {
    return this._dialog?.closing !== true;
  }

  get #entry(): BlocksetEntry | undefined {
    return this._blocksetId === null ?
      undefined :
      this.editing?.blocksets.entry(this._blocksetId);
  }

  override render() {
    const editing = this.editing;
    if (editing === null) {
      return nothing;
    }

    const entry = this.#entry;

    return html`
      <jolly-dialog
        heading=${entry === undefined ? "Blockset" : `Blockset "${entry.label}"`}
        icon="blockset"
        @jolly-exited=${this.#onExited}
      >
        ${entry === undefined ? nothing : this.#renderContent(editing, entry)}

        <jolly-button
          slot="actions"
          class="remove"
          variant="danger"
          icon="trash"
          ?disabled=${entry === undefined || !editing.access.current.has("blocksets")}
          @click=${this.#remove}
        >Remove</jolly-button>
        <jolly-button
          slot="actions"
          variant="accent"
          @click=${this.#close}
        >Close</jolly-button>
      </jolly-dialog>
    `;
  }

  #renderContent(
    editing: VoxelMapEditing,
    entry: BlocksetEntry
  ) {
    const { definition } = entry;
    const tileSize = editing.blocksets.blocksetTileSize(definition.id);
    const resizable = editing.blocksets.access(definition.id).has("tileSize");
    const usage = editing.usage.inspectBlocksetUsage(definition.id);
    const renamable = entry.assetId !== null;
    const pendingTileSize = this._pendingTileSize;

    return html`
      <div class="fields">
        <jolly-text
          label="Name"
          .value=${entry.label}
          ?disabled=${!renamable}
          description=${entry.assetId === null ? "Unlinked texture, read-only" : ""}
          description-display="tooltip"
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => {
            void this.#rename(entry, event.detail.value);
          }}
        ></jolly-text>
        <jolly-button-group
          label="Tile size"
          .options=${tileSizeSegments(tileSize)}
          .value=${pendingTileSize ?? tileSize}
          ?disabled=${!resizable || tileSize === undefined}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
            this.#resize(entry, event.detail.value);
          }}
        ></jolly-button-group>
        ${pendingTileSize === null ? nothing : html`
          <div class="pending" role="alert">
            <jolly-icon name="warning"></jolly-icon>
            <p>${kOffGridWarning}</p>
            <jolly-button
              @click=${() => {
                this._pendingTileSize = null;
              }}
            >Keep ${tileSize}</jolly-button>
            <jolly-button
              variant="accent"
              @click=${() => this.#applyPendingTileSize(entry)}
            >Resize to ${pendingTileSize}</jolly-button>
          </div>
        `}
      </div>
      <p class="usage">${usage.summary}</p>
    `;
  }

  readonly #refresh = (): void => {
    if (this._blocksetId === null) {
      return;
    }
    if (this.#entry === undefined) {
      this.#close();
    }
    this.requestUpdate();
  };

  async #rename(
    entry: BlocksetEntry,
    name: string
  ): Promise<void> {
    try {
      await this.editing?.blocksets.rename(entry.definition.id, name);
    }
    catch (error) {
      this.editing?.state.log.push(`Could not rename "${entry.label}": ${describeError(error)}`);
    }
    this.requestUpdate();
  }

  #resize(
    entry: BlocksetEntry,
    tileSize: number
  ): void {
    const editing = this.editing;
    const { definition } = entry;
    const from = editing?.blocksets.blocksetTileSize(definition.id);
    if (editing === null || from === undefined) {
      return;
    }

    this._pendingTileSize = null;
    if (tileSize === from) {
      return;
    }

    const rescale = {
      blocksetId: definition.id,
      from,
      to: tileSize
    };
    const offGrid = [...editing.editorMap.blocks].some(
      (block) => !BlockTextures.fromBlock(block).canRescaleOnGrid(rescale)
    );
    if (offGrid) {
      this._pendingTileSize = tileSize;

      return;
    }

    editing.blocksets.resizeTiles(definition.id, tileSize);
    this.requestUpdate();
  }

  #applyPendingTileSize(
    entry: BlocksetEntry
  ): void {
    const tileSize = this._pendingTileSize;
    this._pendingTileSize = null;
    if (tileSize !== null) {
      this.editing?.blocksets.resizeTiles(entry.definition.id, tileSize);
    }
  }

  async #remove(): Promise<void> {
    const editing = this.editing;
    const entry = this.#entry;
    if (editing === null || entry === undefined) {
      return;
    }

    const usage = editing.usage.inspectBlocksetUsage(entry.definition.id);
    const confirmed = usage.unused ||
      await this._dialog.confirmInline({
        message: `Remove "${entry.label}"? ` +
          `${usage.removalMessage} The blockset asset is kept.`,
        confirmLabel: "Remove",
        danger: true
      });
    if (confirmed && editing.blocksets.remove(entry.definition.id)) {
      this.#close();
    }
  }

  #close(): void {
    this._dialog.close();
  }

  #onExited(): void {
    this._blocksetId = null;
    this._pendingTileSize = null;
  }
}

function describeError(
  error: unknown
): string {
  return error instanceof Error ? error.message : String(error);
}

declare global {
  interface HTMLElementTagNameMap {
    "blockset-edit-dialog": BlocksetEditDialog;
  }
}
