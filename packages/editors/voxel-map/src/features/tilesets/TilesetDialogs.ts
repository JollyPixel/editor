// Import Third-party Dependencies
import {
  LitElement,
  html
} from "lit";
import {
  customElement,
  property,
  query
} from "lit/decorators.js";
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";
import type { LogQueue } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { MapDocument } from "../../document/index.ts";
import type {
  BlockUsageStore,
  TilesetStore
} from "../../state/index.ts";
import type { TilesetActions } from "./TilesetActions.ts";
import type { AddTilesetDialog } from "./AddTilesetDialog.ts";
import type { TilesetEditDialog } from "./TilesetEditDialog.ts";
import "./AddTilesetDialog.ts";
import "./TilesetEditDialog.ts";

@customElement("tileset-dialogs")
export class TilesetDialogs extends LitElement {
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

  @query("add-tileset-dialog")
  private declare _addDialog: AddTilesetDialog;

  @query("tileset-edit-dialog")
  private declare _editDialog: TilesetEditDialog;

  #adding = false;

  constructor() {
    super();
    this.actions = null;
  }

  async add(): Promise<void> {
    const actions = this.actions;
    if (actions === null || this.#adding) {
      return;
    }

    const result = await this._addDialog.open({
      defaultTileSize: this.tilesets.defaultTileSize,
      linkable: actions.linkableAssets()
    });
    if (result === null) {
      return;
    }

    this.#adding = true;
    try {
      const tilesetId = result.kind === "link" ?
        actions.link(result) :
        await actions.create(result);
      if (tilesetId === null) {
        this.log.push("Could not add the tileset: it was refused by the map.");
      }
      else {
        actions.updateDefaultTileSize(result.tileSize);
        this.tilesets.activeTilesetId = tilesetId;
      }
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.log.push(`Could not add the tileset: ${reason}`);
    }
    finally {
      this.#adding = false;
    }
  }

  async edit(
    tilesetId: string
  ): Promise<void> {
    await this._editDialog.open(tilesetId);
  }

  override render() {
    return html`
      <add-tileset-dialog></add-tileset-dialog>
      <tileset-edit-dialog
        .engine=${this.engine}
        .actions=${this.actions}
        .tilesets=${this.tilesets}
        .mapDocument=${this.mapDocument}
        .usage=${this.usage}
        .log=${this.log}
      ></tileset-edit-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tileset-dialogs": TilesetDialogs;
  }
}
