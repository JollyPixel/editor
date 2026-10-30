// Import Third-party Dependencies
import {
  LitElement,
  html,
  css
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
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/button-group";
import "@jolly-pixel/ui/elements/dialog";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/text";
import {
  AssetPath,
  type AssetRecordData
} from "@jolly-pixel/asset";
import { DEFAULT_TILE_SIZE } from "@jolly-pixel/voxel.renderer";
import { BLOCKSET_EXTENSION } from "@jolly-pixel/asset.voxel-map/client";

// Import Internal Dependencies
import { tileSizeSegments } from "../tileSizes.ts";
import "../blocksetIcons.ts";

// CONSTANTS
const kDefaultName = "blockset";
const kDefaultGridSize = 8;
const kMaxGridSize = 64;
const kConfirmLabels: Record<AddBlocksetSource, string> = {
  create: "Create",
  link: "Link",
  import: "Choose file…"
};

export type AddBlocksetSource = "create" | "link" | "import";

export type AddBlocksetResult =
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
  }
  | {
    kind: "import";
  };

export interface AddBlocksetContext {
  defaultTileSize: number;
  linkable: readonly AssetRecordData[];
  importable: boolean;
}

@customElement("add-blockset-dialog")
export class AddBlocksetDialog extends LitElement {
  static override styles = css`
    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);

      --jolly-label-width: 80px;
      --jolly-field-inset-end: 0px;
    }

    .hint {
      margin: 0;
      color: var(--jolly-text-muted);
      font-size: var(--jolly-font-size-sm, 12px);
    }
  `;

  @state()
  private declare _source: AddBlocksetSource;

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

  @state()
  private declare _importable: boolean;

  @query("jolly-dialog")
  private declare _dialog: Dialog;

  #settle: ((result: AddBlocksetResult | null) => void) | null = null;

  constructor() {
    super();
    this._source = "create";
    this._name = kDefaultName;
    this._assetId = "";
    this._tileSize = DEFAULT_TILE_SIZE;
    this._cols = kDefaultGridSize;
    this._rows = kDefaultGridSize;
    this._linkable = [];
    this._importable = false;
  }

  async open(
    context: AddBlocksetContext
  ): Promise<AddBlocksetResult | null> {
    this.#resolve(null);
    this._source = "create";
    this._name = kDefaultName;
    this._linkable = context.linkable;
    this._importable = context.importable;
    this._assetId = context.linkable[0]?.id ?? "";
    this._tileSize = context.defaultTileSize;
    this._cols = kDefaultGridSize;
    this._rows = kDefaultGridSize;

    const { promise, resolve } = Promise.withResolvers<AddBlocksetResult | null>();
    this.#settle = resolve;

    await this.updateComplete;
    await this._dialog.showModal();

    return promise;
  }

  override render() {
    const source = this._source;

    return html`
      <jolly-dialog
        heading="Add blockset"
        icon="blockset"
        @jolly-cancel=${this.#onCancel}
      >
        <div class="fields">
          <jolly-button-group
            label="Source"
            .options=${this.#sourceOptions()}
            .value=${this._source}
            @jolly-change=${this.#onSourceChange}
          ></jolly-button-group>
          ${this.#renderSourceFields(source)}
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
        >${kConfirmLabels[source]}</jolly-button>
      </jolly-dialog>
    `;
  }

  #renderSourceFields(
    source: AddBlocksetSource
  ) {
    switch (source) {
      case "create":
        return html`${this.#renderCreateFields()}${this.#renderGridFields()}`;
      case "link":
        return this.#renderLinkFields();
      case "import":
        return html`
          <p class="hint">A .zip archive or a ${BLOCKSET_EXTENSION} file.</p>
        `;
      default:
        return source satisfies never;
    }
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
        label: new AssetPath(record.path).name,
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

  #sourceOptions(): JollyOption<AddBlocksetSource>[] {
    return [
      {
        label: "New",
        value: "create"
      },
      {
        label: "Existing",
        value: "link",
        disabled: this._linkable.length === 0
      },
      {
        label: "Import",
        value: "import",
        disabled: !this._importable
      }
    ];
  }

  get #valid(): boolean {
    switch (this._source) {
      case "link":
        return this._assetId !== "";
      case "create":
        return this._name.trim() !== "";
      default:
        return true;
    }
  }

  #onSourceChange(
    event: CustomEvent<JollyChangeDetail<AddBlocksetSource>>
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

    this.#resolve(this.#result());
    this._dialog.close("confirm");
  }

  #result(): AddBlocksetResult {
    switch (this._source) {
      case "link":
        return {
          kind: "link",
          assetId: this._assetId
        };
      case "import":
        return { kind: "import" };
      default:
        return {
          kind: "create",
          name: this._name.trim(),
          tileSize: this._tileSize,
          cols: this._cols,
          rows: this._rows
        };
    }
  }

  #cancel(): void {
    this.#resolve(null);
    this._dialog.close("cancel");
  }

  #onCancel(): void {
    this.#resolve(null);
  }

  #resolve(
    result: AddBlocksetResult | null
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
    "add-blockset-dialog": AddBlocksetDialog;
  }
}
