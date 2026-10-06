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
import { BlockTextures } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../../workspace/WorkspaceElement.ts";
import type { TilesetEntry } from "../TilesetEntry.ts";
import { tileSizeSegments } from "../tileSizes.ts";

// CONSTANTS
const kOffGridWarning = "Some blocks will not line up with the new tile " +
  "grid. They keep covering the same pixels.";

@customElement("tileset-edit-dialog")
export class TilesetEditDialog extends WorkspaceElement {
  static override styles = css`
    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);

      --jolly-label-width: 80px;
      --jolly-field-inset-end: 0;
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
  private declare _tilesetId: string | null;

  @state()
  private declare _pendingTileSize: number | null;

  @query("jolly-dialog")
  private declare _dialog: Dialog;

  constructor() {
    super();
    this._tilesetId = null;
    this._pendingTileSize = null;
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    return [
      workspace.tilesets.subscribe("change", this.#refresh),
      workspace.mapDocument.subscribe("blockRegistryChanged", this.#refresh),
      workspace.usage.subscribe("change", this.#refresh)
    ];
  }

  async open(
    tilesetId: string
  ): Promise<void> {
    if (this.workspace?.tilesets.entry(tilesetId) === undefined) {
      return;
    }

    this._tilesetId = tilesetId;
    await this.updateComplete;
    await this._dialog.showModal();
  }

  get #entry(): TilesetEntry | undefined {
    return this._tilesetId === null ?
      undefined :
      this.workspace?.tilesets.entry(this._tilesetId);
  }

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    const entry = this.#entry;

    return html`
      <jolly-dialog
        heading=${entry === undefined ? "Tileset" : `Tileset "${entry.label}"`}
        icon="tileset"
        @jolly-close=${this.#onClose}
      >
        ${entry === undefined ? nothing : this.#renderContent(workspace, entry)}

        <jolly-button
          slot="actions"
          class="remove"
          variant="danger"
          icon="trash"
          ?disabled=${entry === undefined}
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
    workspace: VoxelMapWorkspace,
    entry: TilesetEntry
  ) {
    const { definition } = entry;
    const tileSize = workspace.tilesets.tileSizeOf(definition.id);
    const usage = workspace.usage.tilesetUsageOf(definition.id);
    const renamable = entry.assetId !== null;
    const pendingTileSize = this._pendingTileSize;

    return html`
      <div class="fields">
        <jolly-text
          label="Name"
          .value=${entry.label}
          ?disabled=${!renamable}
          description=${entry.assetId === null ? "Unlinked texture, read-only" : ""}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => {
            void this.#rename(entry, event.detail.value);
          }}
        ></jolly-text>
        <jolly-button-group
          label="Tile size"
          .options=${tileSizeSegments(tileSize)}
          .value=${pendingTileSize ?? tileSize}
          ?disabled=${tileSize === undefined}
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
    if (this._tilesetId === null) {
      return;
    }
    if (this.#entry === undefined) {
      this.#close();
    }
    this.requestUpdate();
  };

  async #rename(
    entry: TilesetEntry,
    name: string
  ): Promise<void> {
    try {
      await this.workspace?.tilesets.rename(entry.definition.id, name);
    }
    catch (error) {
      this.workspace?.state.log.push(`Could not rename "${entry.label}": ${messageOf(error)}`);
    }
    this.requestUpdate();
  }

  #resize(
    entry: TilesetEntry,
    tileSize: number
  ): void {
    const workspace = this.workspace;
    const { definition } = entry;
    const from = workspace?.tilesets.tileSizeOf(definition.id);
    if (workspace === null || from === undefined) {
      return;
    }

    this._pendingTileSize = null;
    if (tileSize === from) {
      return;
    }

    const rescale = {
      tilesetId: definition.id,
      from,
      to: tileSize
    };
    const offGrid = [...workspace.view.document.blocks].some(
      (block) => !BlockTextures.of(block).staysOnGrid(rescale)
    );
    if (offGrid) {
      this._pendingTileSize = tileSize;

      return;
    }

    workspace.tilesets.resizeTiles(definition.id, tileSize);
    this.requestUpdate();
  }

  #applyPendingTileSize(
    entry: TilesetEntry
  ): void {
    const tileSize = this._pendingTileSize;
    this._pendingTileSize = null;
    if (tileSize !== null) {
      this.workspace?.tilesets.resizeTiles(entry.definition.id, tileSize);
    }
  }

  async #remove(): Promise<void> {
    const workspace = this.workspace;
    const entry = this.#entry;
    if (workspace === null || entry === undefined) {
      return;
    }

    const usage = workspace.usage.tilesetUsageOf(entry.definition.id);
    const confirmed = usage.unused ||
      await this._dialog.confirmInline({
        message: `Remove "${entry.label}"? ` +
          `${usage.removalMessage} The tileset asset is kept.`,
        confirmLabel: "Remove",
        danger: true
      });
    if (confirmed && workspace.tilesets.remove(entry.definition.id)) {
      this.#close();
    }
  }

  #close(): void {
    this._dialog.close();
  }

  #onClose(): void {
    this._tilesetId = null;
    this._pendingTileSize = null;
  }
}

function messageOf(
  error: unknown
): string {
  return error instanceof Error ? error.message : String(error);
}

declare global {
  interface HTMLElementTagNameMap {
    "tileset-edit-dialog": TilesetEditDialog;
  }
}
