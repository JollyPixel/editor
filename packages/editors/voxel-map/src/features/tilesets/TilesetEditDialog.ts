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
  VoxelEngine,
  VoxelTilesetUsage
} from "@jolly-pixel/voxel.renderer";
import type {
  Dialog,
  JollyChangeDetail,
  LogQueue
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { MapDocument } from "../../document/index.ts";
import type {
  BlockUsageStore,
  TilesetEntry,
  TilesetStore
} from "../../state/index.ts";
import type { TilesetActions } from "./TilesetActions.ts";
import { rescaleLeavesBlocksOffGrid } from "./blockTilesets.ts";
import { tileSizeSegments } from "./tileSizes.ts";
import {
  formatCount,
  tilesetIsUnused,
  tilesetRemovalMessage
} from "../blocks/blockUsage.ts";

// CONSTANTS
const kOffGridWarning = "Some blocks will not line up with the new tile " +
  "grid. They keep covering the same pixels.";

@customElement("tileset-edit-dialog")
export class TilesetEditDialog extends LitElement {
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

  @property({ attribute: false })
  declare engine: VoxelEngine;

  @property({ attribute: false })
  declare actions: TilesetActions | null;

  @property({ attribute: false })
  declare tilesets: TilesetStore;

  @property({ attribute: false })
  declare mapDocument: MapDocument;

  @property({ attribute: false })
  declare usage: BlockUsageStore;

  @property({ attribute: false })
  declare log: LogQueue;

  @state()
  private declare _tilesetId: string | null;

  @state()
  private declare _pendingTileSize: number | null;

  @query("jolly-dialog")
  private declare _dialog: Dialog;

  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this.actions = null;
    this._tilesetId = null;
    this._pendingTileSize = null;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      this.tilesets.subscribe("change", this.#refresh),
      this.mapDocument.subscribe("blockRegistryChanged", this.#refresh),
      this.usage.subscribe("change", this.#refresh)
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  async open(
    tilesetId: string
  ): Promise<void> {
    if (this.tilesets.entry(tilesetId) === undefined) {
      return;
    }

    this._tilesetId = tilesetId;
    await this.updateComplete;
    await this._dialog.showModal();
  }

  get #entry(): TilesetEntry | undefined {
    return this._tilesetId === null ?
      undefined :
      this.tilesets.entry(this._tilesetId);
  }

  override render() {
    const entry = this.#entry;

    return html`
      <jolly-dialog
        heading=${entry === undefined ? "Tileset" : `Tileset "${entry.label}"`}
        icon="sliders"
        @jolly-close=${this.#onClose}
      >
        ${entry === undefined ? nothing : this.#renderContent(entry)}

        <jolly-button
          slot="actions"
          class="remove"
          variant="danger"
          icon="trash"
          ?disabled=${this.actions === null || entry === undefined}
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
    entry: TilesetEntry
  ) {
    const { definition } = entry;
    const usage = this.usage.tilesetUsageOf(definition.id);
    const renamable = this.actions !== null && entry.assetId !== null;
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
          .options=${tileSizeSegments(definition.tileSize)}
          .value=${pendingTileSize ?? definition.tileSize}
          ?disabled=${this.actions === null}
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
            >Keep ${definition.tileSize}</jolly-button>
            <jolly-button
              variant="accent"
              @click=${() => this.#applyPendingTileSize(entry)}
            >Resize to ${pendingTileSize}</jolly-button>
          </div>
        `}
      </div>
      <p class="usage">${usageSummary(usage)}</p>
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
      await this.actions?.rename(entry.definition.id, name);
    }
    catch (error) {
      this.log.push(`Could not rename "${entry.label}": ${messageOf(error)}`);
    }
    this.requestUpdate();
  }

  #resize(
    entry: TilesetEntry,
    tileSize: number
  ): void {
    const { definition } = entry;
    if (this.actions === null) {
      return;
    }

    this._pendingTileSize = null;
    if (tileSize === definition.tileSize) {
      return;
    }

    const offGrid = rescaleLeavesBlocksOffGrid(
      this.engine.blockRegistry,
      {
        tilesetId: definition.id,
        from: definition.tileSize,
        to: tileSize
      }
    );
    if (offGrid) {
      this._pendingTileSize = tileSize;

      return;
    }

    this.actions.resize(definition.id, tileSize);
    this.requestUpdate();
  }

  #applyPendingTileSize(
    entry: TilesetEntry
  ): void {
    const tileSize = this._pendingTileSize;
    this._pendingTileSize = null;
    if (this.actions !== null && tileSize !== null) {
      this.actions.resize(entry.definition.id, tileSize);
    }
  }

  async #remove(): Promise<void> {
    const entry = this.#entry;
    if (this.actions === null || entry === undefined) {
      return;
    }

    const usage = this.usage.tilesetUsageOf(entry.definition.id);
    const confirmed = tilesetIsUnused(usage) ||
      await this._dialog.confirmInline({
        message: `Remove "${entry.label}"? ` +
          `${tilesetRemovalMessage(usage)} The texture asset is kept.`,
        confirmLabel: "Remove",
        danger: true
      });
    if (confirmed && this.actions.remove(entry.definition.id)) {
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

function usageSummary(
  usage: VoxelTilesetUsage
): string {
  return `Used by ${formatCount(usage.blocks.length, "block")}, ` +
    `${formatCount(usage.voxels, "voxel")} in the map.`;
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
