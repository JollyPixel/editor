// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { VoxelRenderer, TilesetDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { EventInput } from "./types.ts";

@customElement("tileset-manager")
export class TilesetManager extends LitElement {
  static override styles = css`
    :host {
      display: block;
      padding: 8px;
      color: #ccc;
      font-size: 13px;
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }

    .tileset-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 10px;
    }
    .tileset-item {
      background: #1a2228;
      border: 1px solid #2a3540;
      border-radius: 4px;
      padding: 6px 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tileset-item img {
      width: 48px;
      height: 48px;
      object-fit: contain;
      image-rendering: pixelated;
      border: 1px solid #333;
      border-radius: 2px;
      background: #111;
    }
    .tileset-info {
      flex: 1;
      overflow: hidden;
    }
    .tileset-id {
      font-weight: 600;
      font-size: 12px;
      color: #eee;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tileset-meta {
      font-size: 11px;
      color: #888;
    }
    .add-form {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .form-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .form-row label {
      min-width: 70px;
      font-size: 12px;
      color: #aaa;
    }
    .form-row input[type="text"],
    .form-row input[type="number"],
    .form-row input[type="url"] {
      flex: 1;
      background: #111a20;
      border: 1px solid #333;
      color: #eee;
      padding: 3px 6px;
      border-radius: 3px;
      font-size: 12px;
    }

    button.add-btn {
      background: #2a3a4a;
      border: 1px solid #4488ff;
      color: #4488ff;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-top: 4px;
      align-self: flex-start;
    }
    button.add-btn:hover {
      background: #3a5a7a;
    }

    .error {
      color: #ff6666;
      font-size: 11px;
      margin-top: 4px;
    }
  `;

  @property({ attribute: false }) declare vr: VoxelRenderer;

  @state() private declare _definitions: Array<TilesetDefinition & { cols: number; rows: number; }>;
  @state() private declare _newId: string;
  @state() private declare _newSrc: string;
  @state() private declare _newTileSize: number;
  @state() private declare _error: string;
  @state() private declare _loading: boolean;

  constructor() {
    super();

    this._definitions = [];
    this._newId = "";
    this._newSrc = "";
    this._newTileSize = 16;
    this._error = "";
    this._loading = false;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#refresh();
  }

  #refresh(): void {
    if (!this.vr) {
      return;
    }

    this._definitions = this.vr.tilesetManager.getDefinitions();
  }

  override render() {
    return html`
      <div class="section-title">Tilesets</div>

      <div class="tileset-list">
        ${this._definitions.map((def) => html`
          <div class="tileset-item">
            <img src=${def.src} alt=${def.id} />
            <div class="tileset-info">
              <div class="tileset-id">${def.id}</div>
              <div class="tileset-meta">
                ${def.cols}×${def.rows} tiles · ${def.tileSize}px
              </div>
            </div>
          </div>
        `)}
      </div>

      <div class="section-title">Add Tileset</div>
      <div class="add-form">
        <div class="form-row">
          <label>ID</label>
          <input
            type="text"
            placeholder="my-tileset"
            .value=${this._newId}
            @input=${(event: EventInput) => {
              this._newId = event.target.value;
            }}
          />
        </div>
        <div class="form-row">
          <label>URL / Path</label>
          <input
            type="url"
            placeholder="textures/tileset.png"
            .value=${this._newSrc}
            @input=${(event: EventInput) => {
              this._newSrc = event.target.value;
            }}
          />
        </div>
        <div class="form-row">
          <label>Tile Size</label>
          <input
            type="number"
            min="1"
            .value=${this._newTileSize}
            @input=${(event: EventInput) => {
              this._newTileSize = parseInt(event.target.value, 10) || 16;
            }}
          />
        </div>
        ${this._error
            ? html`<div class="error">${this._error}</div>`
            : null
        }
        <button
          class="add-btn"
          ?disabled=${this._loading}
          @click=${this.#onAdd}
        >
          ${this._loading ? "Loading…" : "Add Tileset"}
        </button>
      </div>
    `;
  }

  async #onAdd(): Promise<void> {
    this._error = "";
    const id = this._newId.trim();
    const src = this._newSrc.trim();
    if (!id || !src) {
      this._error = "ID and URL are required.";

      return;
    }

    this._loading = true;

    try {
      await this.vr.loadTileset({
        id,
        src,
        tileSize: this._newTileSize
      });
      this._newId = "";
      this._newSrc = "";

      this.#refresh();
      this.dispatchEvent(
        new CustomEvent("tileset-added", { bubbles: true, composed: true })
      );
    }
    catch (err) {
      this._error = `Failed: ${String(err)}`;
    }
    finally {
      this._loading = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tileset-manager": TilesetManager;
  }
}
