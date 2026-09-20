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
import { repeat } from "lit/directives/repeat.js";
import type {
  VoxelEngine,
  VoxelTilesetUsage
} from "@jolly-pixel/voxel.renderer";
import {
  showConfirm,
  type Dialog,
  type JollyChangeDetail,
  type LogQueue
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  editorState,
  type BlockUsageStore,
  type TilesetStore,
  type WorldStore
} from "../../app/state/index.ts";
import type { TilesetActions } from "./TilesetActions.ts";
import type { TilesetEntry } from "./tilesetEntries.ts";
import { rescaleLeavesBlocksOffGrid } from "./blockTilesets.ts";
import { tileSizeOptions } from "./tileSizes.ts";
import {
  formatCount,
  tilesetRemovalMessage
} from "../blocks/blockUsage.ts";

@customElement("tileset-manager-dialog")
export class TilesetManagerDialog extends LitElement {
  static override styles = css`
    .settings {
      --jolly-label-width: 110px;

      margin-block-end: var(--jolly-space-3, 12px);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      padding: var(--jolly-space-1, 4px);
      color: var(--jolly-text-muted);
      font-weight: normal;
      text-align: start;
    }

    td {
      padding: var(--jolly-space-1, 4px);
      vertical-align: middle;
    }

    td.name {
      width: 100%;
    }

    td.count {
      white-space: nowrap;
      text-align: end;
    }

    td jolly-text,
    td jolly-select {
      --jolly-label-width: 0;
    }

    .unlinked {
      color: var(--jolly-text-muted);
    }

    .empty {
      color: var(--jolly-text-muted);
    }
  `;

  @property({ attribute: false })
  declare engine: VoxelEngine | undefined;

  @property({ attribute: false })
  declare actions: TilesetActions | null;

  @property({ attribute: false })
  declare tilesets: TilesetStore;

  @property({ attribute: false })
  declare worldStore: WorldStore;

  @property({ attribute: false })
  declare usage: BlockUsageStore;

  @property({ attribute: false })
  declare log: LogQueue;

  @property({ attribute: false })
  declare onAdd: (() => void) | null;

  @state()
  private declare _open: boolean;

  @query("jolly-dialog")
  private declare _dialog: Dialog;

  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this.engine = undefined;
    this.actions = null;
    this.tilesets = editorState.tilesets;
    this.worldStore = editorState.world;
    this.usage = editorState.usage;
    this.log = editorState.log;
    this.onAdd = null;
    this._open = false;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      this.tilesets.subscribe("change", this.#refresh),
      this.worldStore.subscribe("blockRegistryChanged", this.#refresh),
      this.usage.subscribe("change", this.#refresh)
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  async open(): Promise<void> {
    this._open = true;
    await this.updateComplete;
    await this._dialog.showModal();
  }

  override render() {
    return html`
      <jolly-dialog
        heading="Tilesets"
        @jolly-close=${this.#onClose}
      >
        ${this._open ? this.#renderContent() : nothing}

        <jolly-button
          slot="actions"
          icon="plus"
          ?disabled=${this.actions === null}
          @click=${this.#onAddClick}
        >Add tileset</jolly-button>
        <jolly-button
          slot="actions"
          variant="accent"
          @click=${this.#close}
        >Close</jolly-button>
      </jolly-dialog>
    `;
  }

  #renderContent() {
    const { entries } = this.tilesets;

    return html`
      <div class="settings">
        <jolly-select
          label="Default tile size"
          description="Pre-selected when adding a tileset"
          .options=${tileSizeOptions(this.tilesets.defaultTileSize)}
          .value=${this.tilesets.defaultTileSize}
          ?disabled=${this.actions === null}
          @jolly-change=${this.#onDefaultTileSizeChange}
        ></jolly-select>
      </div>

      ${entries.length === 0 ?
        html`<p class="empty">This map has no tileset.</p>` :
        html`
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Tile size</th>
                <th>Blocks</th>
                <th>Voxels</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${repeat(
                entries,
                (entry) => entry.definition.id,
                (entry) => this.#renderRow(
                  entry,
                  this.usage.tilesetUsageOf(entry.definition.id)
                )
              )}
            </tbody>
          </table>
        `}
    `;
  }

  #renderRow(
    entry: TilesetEntry,
    usage: VoxelTilesetUsage
  ) {
    const { definition } = entry;
    const editable = this.actions !== null && entry.assetId !== null;

    return html`
      <tr>
        <td class="name">
          <jolly-text
            aria-label="Tileset name"
            .value=${entry.label}
            ?disabled=${!editable}
            description=${entry.assetId === null ? "Unlinked texture, read-only" : ""}
            @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => {
              void this.#rename(entry, event.detail.value);
            }}
          ></jolly-text>
        </td>
        <td>
          <jolly-select
            aria-label="Tile size"
            .options=${tileSizeOptions(definition.tileSize)}
            .value=${definition.tileSize}
            ?disabled=${this.actions === null}
            @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
              void this.#resize(entry, event.detail.value);
            }}
          ></jolly-select>
        </td>
        <td class="count blocks">${formatCount(usage.blocks.length, "block")}</td>
        <td class="count voxels">${formatCount(usage.voxels, "voxel")}</td>
        <td>
          <jolly-button
            icon="trash"
            icon-only
            label="Remove tileset"
            title="Remove tileset"
            ?disabled=${this.actions === null}
            @click=${() => void this.#remove(entry, usage)}
          ></jolly-button>
        </td>
      </tr>
    `;
  }

  readonly #refresh = (): void => {
    if (this._open) {
      this.requestUpdate();
    }
  };

  #onDefaultTileSizeChange(
    event: CustomEvent<JollyChangeDetail<number>>
  ): void {
    this.actions?.updateDefaultTileSize(event.detail.value);
  }

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

  async #resize(
    entry: TilesetEntry,
    tileSize: number
  ): Promise<void> {
    const { definition } = entry;
    if (this.actions === null || tileSize === definition.tileSize) {
      return;
    }

    const offGrid = this.engine !== undefined && rescaleLeavesBlocksOffGrid(
      this.engine.blockRegistry,
      {
        tilesetId: definition.id,
        from: definition.tileSize,
        to: tileSize
      }
    );
    const confirmed = !offGrid || await showConfirm({
      title: `Resize "${entry.label}"?`,
      message: "Some blocks will not line up with the new tile grid. " +
        "They keep covering the same pixels.",
      confirmLabel: "Resize"
    });
    if (confirmed) {
      this.actions.resize(definition.id, tileSize);
    }
    this.requestUpdate();
  }

  async #remove(
    entry: TilesetEntry,
    usage: VoxelTilesetUsage
  ): Promise<void> {
    if (this.actions === null) {
      return;
    }

    const confirmed = await showConfirm({
      title: `Remove "${entry.label}"?`,
      message: `${tilesetRemovalMessage(usage)} The texture asset is kept.`,
      confirmLabel: "Remove",
      danger: true
    });
    if (confirmed) {
      this.actions.remove(entry.definition.id);
    }
  }

  #onAddClick(): void {
    this.onAdd?.();
  }

  #close(): void {
    this._dialog.close();
  }

  #onClose(): void {
    this._open = false;
  }
}

function messageOf(
  error: unknown
): string {
  return error instanceof Error ? error.message : String(error);
}

declare global {
  interface HTMLElementTagNameMap {
    "tileset-manager-dialog": TilesetManagerDialog;
  }
}
