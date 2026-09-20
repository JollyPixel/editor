// Import Third-party Dependencies
import {
  LitElement,
  html,
  css
} from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";
import type { LogQueue } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  editorState,
  type TilesetStore,
  type WorldStore
} from "../../app/state/index.ts";
import type { TilesetActions } from "./TilesetActions.ts";
import type { TilesetEntry } from "./tilesetEntries.ts";
import { countBlocksPerTileset } from "./blockTilesets.ts";
import { AddTilesetDialog } from "./AddTilesetDialog.ts";
import { TilesetManagerDialog } from "./TilesetManagerDialog.ts";

@customElement("tileset-folder")
export class TilesetFolder extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    ul {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: var(--jolly-space-1, 4px);
      list-style: none;
      gap: 2px;
    }

    button {
      display: flex;
      align-items: center;
      width: 100%;
      gap: var(--jolly-space-1, 4px);
      padding: 2px var(--jolly-space-1, 4px);
      border: 0;
      border-radius: var(--jolly-radius-sm, 3px);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }

    button:hover {
      background: var(--jolly-control-bg-hover);
    }

    button[aria-current="true"] {
      background: var(--jolly-tab-selected-bg);
    }

    .label {
      overflow: hidden;
      flex: 1 1 auto;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .meta {
      flex: 0 0 auto;
      color: var(--jolly-text-muted);
      font-size: var(--jolly-font-size-sm, 12px);
    }

    .empty {
      margin: 0;
      padding: var(--jolly-space-1, 4px);
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
  declare log: LogQueue;

  @state()
  private declare _busy: boolean;

  @query("add-tileset-dialog")
  private declare _addDialog: AddTilesetDialog;

  @query("tileset-manager-dialog")
  private declare _managerDialog: TilesetManagerDialog;

  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this.engine = undefined;
    this.actions = null;
    this.tilesets = editorState.tilesets;
    this.worldStore = editorState.world;
    this.log = editorState.log;
    this._busy = false;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      this.tilesets.subscribe("change", this.#refresh),
      this.tilesets.subscribe("activeChange", this.#refresh),
      this.worldStore.subscribe("blockRegistryChanged", this.#refresh)
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  async addTileset(): Promise<void> {
    const actions = this.actions;
    if (actions === null || this._busy) {
      return;
    }

    const result = await this._addDialog.open({
      defaultTileSize: this.tilesets.defaultTileSize,
      linkable: actions.linkableAssets()
    });
    if (result === null) {
      return;
    }

    this._busy = true;
    try {
      const tilesetId = result.kind === "link" ?
        actions.link(result) :
        await actions.create(result);
      if (tilesetId === null) {
        this.log.push("Could not add the tileset: it was refused by the map.");
      }
      else {
        this.tilesets.activeTilesetId = tilesetId;
      }
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.log.push(`Could not add the tileset: ${reason}`);
    }
    finally {
      this._busy = false;
    }
  }

  async manageTilesets(): Promise<void> {
    await this._managerDialog.open();
  }

  override render() {
    const blocks = this.engine ? [...this.engine.blockRegistry.getAll()] : [];
    const counts = countBlocksPerTileset(blocks);

    return html`
      ${this.tilesets.entries.length === 0 ?
        html`<p class="empty">No tileset yet.</p>` :
        html`
          <ul>
            ${repeat(
              this.tilesets.entries,
              (entry) => entry.definition.id,
              (entry) => this.#renderEntry(entry, counts.get(entry.definition.id) ?? 0)
            )}
          </ul>
        `}

      <add-tileset-dialog></add-tileset-dialog>
      <tileset-manager-dialog
        .engine=${this.engine}
        .actions=${this.actions}
        .tilesets=${this.tilesets}
        .worldStore=${this.worldStore}
        .log=${this.log}
        .onAdd=${() => void this.addTileset()}
      ></tileset-manager-dialog>
    `;
  }

  #renderEntry(
    entry: TilesetEntry,
    count: number
  ) {
    const { definition } = entry;
    const active = this.tilesets.activeTilesetId === definition.id;
    const blocks = `${count} block${count === 1 ? "" : "s"}`;

    return html`
      <li>
        <button
          type="button"
          aria-current=${active ? "true" : "false"}
          title=${entry.assetId === null ? "Unlinked texture" : entry.label}
          @click=${() => {
            this.tilesets.activeTilesetId = definition.id;
          }}
        >
          <span class="label">${entry.label}</span>
          <span class="meta">${definition.tileSize}px · ${blocks}</span>
        </button>
      </li>
    `;
  }

  readonly #refresh = (): void => {
    this.requestUpdate();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "tileset-folder": TilesetFolder;
  }
}
