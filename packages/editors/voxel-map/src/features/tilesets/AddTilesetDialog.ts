// Import Third-party Dependencies
import {
  LitElement,
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
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";
import {
  AssetSource,
  type AssetRecordData
} from "@jolly-pixel/asset";
import { DEFAULT_TILE_SIZE } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { tileSizeSegments } from "./tileSizes.ts";

// CONSTANTS
const kDefaultName = "tileset";
const kDefaultGridSize = 8;
const kMaxGridSize = 64;

export type AddTilesetSource = "create" | "link";

export type AddTilesetResult =
  | {
    kind: "create";
    name: string;
    tileSize: number;
    cols: number;
    rows: number;
  }
  | {
    kind: "link";
    assetId: string;
  };

export interface AddTilesetContext {
  defaultTileSize: number;
  linkable: readonly AssetRecordData[];
}

@customElement("add-tileset-dialog")
export class AddTilesetDialog extends LitElement {
  static override styles = css`
    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);

      --jolly-label-width: 80px;
      --jolly-field-inset-end: 0;
    }
  `;

  @state()
  private declare _source: AddTilesetSource;

  @state()
  private declare _name: string;

  @state()
  private declare _assetId: string;

  @state()
  private declare _tileSize: number;

  @state()
  private declare _cols: number;

  @state()
  private declare _rows: number;

  @state()
  private declare _linkable: readonly AssetRecordData[];

  @query("jolly-dialog")
  private declare _dialog: Dialog;

  #settle: ((result: AddTilesetResult | null) => void) | null = null;

  constructor() {
    super();
    this._source = "create";
    this._name = kDefaultName;
    this._assetId = "";
    this._tileSize = DEFAULT_TILE_SIZE;
    this._cols = kDefaultGridSize;
    this._rows = kDefaultGridSize;
    this._linkable = [];
  }

  async open(
    context: AddTilesetContext
  ): Promise<AddTilesetResult | null> {
    this.#resolve(null);
    this._source = "create";
    this._name = kDefaultName;
    this._linkable = context.linkable;
    this._assetId = context.linkable[0]?.id ?? "";
    this._tileSize = context.defaultTileSize;
    this._cols = kDefaultGridSize;
    this._rows = kDefaultGridSize;

    const { promise, resolve } = Promise.withResolvers<AddTilesetResult | null>();
    this.#settle = resolve;

    await this.updateComplete;
    await this._dialog.showModal();

    return promise;
  }

  override render() {
    const linking = this._source === "link";

    return html`
      <jolly-dialog
        heading="Add tileset"
        icon="plus"
        @jolly-cancel=${this.#onCancel}
      >
        <div class="fields">
          <jolly-button-group
            label="Source"
            .options=${this.#sourceOptions()}
            .value=${this._source}
            @jolly-change=${this.#onSourceChange}
          ></jolly-button-group>
          ${linking ? this.#renderLinkFields() : this.#renderCreateFields()}
          ${linking ? nothing : this.#renderGridFields()}
        </div>

        <jolly-button
          slot="actions"
          @click=${this.#cancel}
        >Cancel</jolly-button>
        <jolly-button
          slot="actions"
          variant="accent"
          ?disabled=${!this.#valid}
          @click=${this.#confirm}
        >${linking ? "Link" : "Create"}</jolly-button>
      </jolly-dialog>
    `;
  }

  #renderCreateFields() {
    return html`
      <jolly-text
        label="Name"
        .value=${this._name}
        @jolly-change=${this.#onNameChange}
      ></jolly-text>
      <jolly-button-group
        label="Tile size"
        .options=${tileSizeSegments(this._tileSize)}
        .value=${this._tileSize}
        @jolly-change=${this.#onTileSizeChange}
      ></jolly-button-group>
    `;
  }

  #renderLinkFields() {
    const options: JollyOption<string>[] = this._linkable.map((record) => {
      return {
        label: new AssetSource(record.source).name,
        value: record.id
      };
    });

    return html`
      <jolly-select
        label="Texture"
        .options=${options}
        .value=${this._assetId}
        @jolly-change=${this.#onAssetChange}
      ></jolly-select>
    `;
  }

  #renderGridFields() {
    return html`
      <jolly-number
        label="Columns"
        min="1"
        max=${kMaxGridSize}
        .value=${this._cols}
        @jolly-change=${this.#onColsChange}
      ></jolly-number>
      <jolly-number
        label="Rows"
        min="1"
        max=${kMaxGridSize}
        .value=${this._rows}
        @jolly-change=${this.#onRowsChange}
      ></jolly-number>
    `;
  }

  #sourceOptions(): JollyOption<AddTilesetSource>[] {
    return [
      {
        label: "New",
        value: "create"
      },
      {
        label: "Existing",
        value: "link",
        disabled: this._linkable.length === 0
      }
    ];
  }

  get #valid(): boolean {
    return this._source === "link" ?
      this._assetId !== "" :
      this._name.trim() !== "";
  }

  #onSourceChange(
    event: CustomEvent<JollyChangeDetail<AddTilesetSource>>
  ): void {
    this._source = event.detail.value;
  }

  #onNameChange(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this._name = event.detail.value;
  }

  #onAssetChange(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this._assetId = event.detail.value;
  }

  #onTileSizeChange(
    event: CustomEvent<JollyChangeDetail<number>>
  ): void {
    this._tileSize = event.detail.value;
  }

  #onColsChange(
    event: CustomEvent<JollyChangeDetail<number>>
  ): void {
    this._cols = gridSize(event.detail.value);
  }

  #onRowsChange(
    event: CustomEvent<JollyChangeDetail<number>>
  ): void {
    this._rows = gridSize(event.detail.value);
  }

  #confirm(): void {
    if (!this.#valid) {
      return;
    }

    this.#resolve(this._source === "link" ?
      {
        kind: "link",
        assetId: this._assetId
      } :
      {
        kind: "create",
        name: this._name.trim(),
        tileSize: this._tileSize,
        cols: this._cols,
        rows: this._rows
      });
    this._dialog.close("confirm");
  }

  #cancel(): void {
    this.#resolve(null);
    this._dialog.close("cancel");
  }

  #onCancel(): void {
    this.#resolve(null);
  }

  #resolve(
    result: AddTilesetResult | null
  ): void {
    const settle = this.#settle;
    this.#settle = null;
    settle?.(result);
  }
}

function gridSize(
  value: number
): number {
  return Math.min(kMaxGridSize, Math.max(1, Math.round(value)));
}

declare global {
  interface HTMLElementTagNameMap {
    "add-tileset-dialog": AddTilesetDialog;
  }
}
