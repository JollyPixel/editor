// Import Third-party Dependencies
import {
  LitElement,
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import {
  ARCHIVE_MIME_TYPE,
  type CatalogClient
} from "@jolly-pixel/asset-server/catalog/client";
import {
  LocalStorageAdapter,
  type JollyChangeDetail,
  type JollyOption,
  type JollyReparentDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { AssetKindSet } from "../../catalog/AssetKindSet.ts";
import {
  AssetTreeModel,
  folderNodeId,
  type AssetLeafData,
  type AssetRelocation
} from "../../catalog/AssetTreeModel.ts";
import type { AssetDeleteDialog } from "./AssetDeleteDialog.ts";
import "./AssetDeleteDialog.ts";

// CONSTANTS
const kProjectRoot = "the project root";
const kKindStorageKey = "studio:asset-kind";
const kArchiveExtension = ".zip";
const kAllKinds: JollyOption<string> = {
  value: "",
  label: "All kinds",
  icon: "all-kinds"
};

export interface AssetBrowserOptions {
  catalog: CatalogClient;
  kinds: AssetKindSet;
}

export interface AssetOpenDetail {
  assetId: string;
}

export interface AssetErrorDetail {
  message: string;
}

type RelocationVerb = "rename" | "move";

@customElement("asset-browser")
export class AssetBrowser extends LitElement {
  @property({ attribute: false })
  declare options: AssetBrowserOptions | null;

  @state()
  declare _model: AssetTreeModel;

  @state()
  declare _expanded: ReadonlySet<string> | null;

  @state()
  declare _selected: readonly string[];

  @state()
  declare _pendingLabels: ReadonlyMap<string, string>;

  @state()
  declare _kind: string;

  @query("jolly-tree")
  declare _tree: HTMLElementTagNameMap["jolly-tree"] | null;

  @query("asset-delete-dialog")
  declare _deleteDialog: AssetDeleteDialog;

  #catalog: CatalogClient | null = null;
  #storage = new LocalStorageAdapter();

  constructor() {
    super();
    this.options = null;
    this._model = AssetTreeModel.EMPTY;
    this._expanded = null;
    this._selected = [];
    this._pendingLabels = new Map();
    this._kind = this.#storage.get(kKindStorageKey) ?? "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#listen();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#catalog?.off("change", this.#onCatalogChange);
    this.#catalog = null;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("options")) {
      this.#listen();
    }
    else if (changed.has("_kind")) {
      this.#onCatalogChange();
    }
  }

  override render(): TemplateResult {
    const empty = this._selected.length === 0;
    const exportable = this.#selectedAsset() !== null;

    return html`
      <jolly-button-group
        class="kinds"
        icon-only
        aria-label="Asset kind"
        .options=${[kAllKinds, ...this.#kinds.toOptions()]}
        .value=${this._kind}
        @jolly-change=${this.#onKindChange}
      ></jolly-button-group>
      <jolly-toolbar label="Asset actions">
        <jolly-button
          icon="pencil"
          icon-only
          label="Rename"
          title="Rename (F2)"
          ?disabled=${empty}
          @click=${this.#beginRename}
        ></jolly-button>
        <jolly-button
          icon="trash"
          icon-only
          variant="danger"
          label="Delete"
          title="Delete (Del)"
          ?disabled=${empty}
          @click=${this.#deleteSelected}
        ></jolly-button>
        <jolly-button
          icon="export"
          icon-only
          label="Export"
          title="Export as a ZIP archive"
          ?disabled=${!exportable}
          @click=${this.#exportSelected}
        ></jolly-button>
      </jolly-toolbar>
      <jolly-tree
        renamable
        reorderable
        row-drag
        activate-on-double-click
        indent-guides
        .nodes=${this._model.withLabels(this._pendingLabels)}
        .expanded=${[...this._expanded ?? []]}
        .selected=${this._selected}
        .acceptDrop=${this.#acceptDrop}
        @jolly-select=${this.#onSelect}
        @jolly-toggle-expand=${this.#onToggleExpand}
        @jolly-activate=${this.#onActivate}
        @jolly-rename=${this.#onRename}
        @jolly-reparent=${this.#onReparent}
        @keydown=${this.#onKeyDown}
      ></jolly-tree>
      <asset-delete-dialog></asset-delete-dialog>
    `;
  }

  get #kinds(): AssetKindSet {
    return this.options?.kinds ?? AssetKindSet.EMPTY;
  }

  #listen(): void {
    const catalog = this.isConnected ? this.options?.catalog ?? null : null;
    if (catalog === this.#catalog) {
      return;
    }

    this.#catalog?.off("change", this.#onCatalogChange);
    this.#catalog = catalog;
    this.#catalog?.on("change", this.#onCatalogChange);
    this.#onCatalogChange();
  }

  #toggle(
    nodeId: string,
    expanded: boolean
  ): void {
    const next = new Set(this._expanded);
    if (expanded) {
      next.add(nodeId);
    }
    else {
      next.delete(nodeId);
    }
    this._expanded = next;
  }

  async #relocate(
    relocations: AssetRelocation[],
    verb: RelocationVerb
  ): Promise<void> {
    const catalog = this.#catalog;
    if (catalog === null) {
      return;
    }

    const labels = new Map(this._pendingLabels);
    for (const relocation of relocations) {
      if (verb === "rename") {
        labels.set(relocation.nodeId, relocation.to.name);
      }
      this.#followFolder(relocation);
    }
    this._pendingLabels = labels;

    for (const relocation of relocations) {
      let applied = 0;
      try {
        for (const rename of relocation.renames) {
          await catalog.rename(rename.assetId, rename.to);
          applied++;
        }
      }
      catch (error) {
        const restored = new Map(this._pendingLabels);
        restored.delete(relocation.nodeId);
        this._pendingLabels = restored;
        this.#error(relocationFailure(verb, relocation, applied, error));

        return;
      }
    }
  }

  async #delete(
    nodeId: string
  ): Promise<void> {
    const catalog = this.#catalog;
    const node = this._model.node(nodeId);
    const assets = this._model.assetsUnder(nodeId);
    if (
      catalog === null ||
      node?.data === undefined ||
      assets.length === 0
    ) {
      return;
    }

    const deleted = new Set(assets.map((asset) => asset.id));
    const dependents = new Set<string>();
    for (const asset of assets) {
      for (const dependent of catalog.liveDependentsOf(asset.id)) {
        if (!deleted.has(dependent.id)) {
          dependents.add(dependent.source);
        }
      }
    }
    const confirmed = await this._deleteDialog.open({
      name: node.label,
      folder: node.data.type === "folder",
      assets: assets.map((asset) => asset.path.toString()),
      dependents: [...dependents].sort()
    });
    if (confirmed) {
      await this.#remove(catalog, node.label, assets);
    }
  }

  async #remove(
    catalog: CatalogClient,
    name: string,
    assets: AssetLeafData[]
  ): Promise<void> {
    let removed = 0;
    try {
      for (const asset of assets) {
        await catalog.remove(asset.id, {
          force: catalog.liveDependentsOf(asset.id).length > 0
        });
        removed++;
      }
    }
    catch (error) {
      this.#error(assets.length === 1 ?
        `Could not delete "${name}": ${reasonOf(error)}` :
        `Deleted ${removed} of ${assets.length} assets under "${name}": ${reasonOf(error)}`);
    }
  }

  async #export(
    asset: AssetLeafData
  ): Promise<void> {
    const catalog = this.#catalog;
    if (catalog === null) {
      return;
    }

    try {
      const bytes = await catalog.exportArchive(asset.id);
      download(
        new Blob([Uint8Array.from(bytes)], { type: ARCHIVE_MIME_TYPE }),
        `${asset.path.stem || asset.id}${kArchiveExtension}`
      );
    }
    catch (error) {
      this.#error(`Could not export "${asset.path.name}": ${reasonOf(error)}`);
    }
  }

  #selectedAsset(): AssetLeafData | null {
    const [nodeId] = this._selected;
    const data = nodeId === undefined ?
      undefined :
      this._model.node(nodeId)?.data;

    return data?.type === "asset" ? data : null;
  }

  #followFolder(
    relocation: AssetRelocation
  ): void {
    if (this._model.node(relocation.nodeId)?.data?.type !== "folder") {
      return;
    }

    const rebase = (nodeId: string): string => {
      const folder = this._model.node(nodeId)?.data;

      return folder?.type === "folder" ?
        folderNodeId(folder.path.rebase(relocation.from, relocation.to)) :
        nodeId;
    };
    if (this._expanded !== null) {
      this._expanded = new Set([
        ...this._expanded,
        ...[...this._expanded].map(rebase)
      ]);
    }
    this._selected = this._selected.map(rebase);
  }

  #error(
    message: string
  ): void {
    this.dispatchEvent(new CustomEvent<AssetErrorDetail>("asset-error", {
      bubbles: true,
      detail: { message }
    }));
  }

  readonly #onCatalogChange = (): void => {
    const records = [...this.#catalog?.records() ?? []];
    const kinds = this.#kinds;
    const model = new AssetTreeModel(records, {
      presenter: kinds,
      kind: kinds.has(this._kind) ? this._kind : null
    });
    this._model = model;
    this._expanded ??= this.#catalog === null ?
      null :
      new Set(new AssetTreeModel(records).folderIds());
    this._selected = this._selected.filter((nodeId) => model.has(nodeId));

    const labels = new Map(this._pendingLabels);
    for (const [nodeId, label] of labels) {
      const current = model.node(nodeId);
      if (current === undefined || current.label === label) {
        labels.delete(nodeId);
      }
    }
    this._pendingLabels = labels;
  };

  readonly #onKindChange = (
    event: CustomEvent<JollyChangeDetail<string>>
  ): void => {
    this._kind = event.detail.value;
    this.#storage.set(kKindStorageKey, this._kind);
  };

  readonly #exportSelected = (): void => {
    const asset = this.#selectedAsset();
    if (asset !== null) {
      void this.#export(asset);
    }
  };

  readonly #acceptDrop = (
    detail: JollyReparentDetail
  ): boolean => this._model.acceptsDrop(detail);

  readonly #onSelect = (
    event: HTMLElementEventMap["jolly-select"]
  ): void => {
    this._selected = event.detail.selected.filter((nodeId) => this._model.has(nodeId));
  };

  readonly #onToggleExpand = (
    event: HTMLElementEventMap["jolly-toggle-expand"]
  ): void => {
    this.#toggle(event.detail.id, event.detail.expanded);
  };

  readonly #onActivate = (
    event: HTMLElementEventMap["jolly-activate"]
  ): void => {
    const nodeId = event.detail.id;
    const data = this._model.node(nodeId)?.data;
    if (data?.type === "folder") {
      this.#toggle(nodeId, !this._expanded?.has(nodeId));
    }
    else if (data?.type === "asset") {
      this.dispatchEvent(new CustomEvent<AssetOpenDetail>("asset-open", {
        bubbles: true,
        detail: { assetId: data.id }
      }));
    }
  };

  readonly #onRename = (
    event: HTMLElementEventMap["jolly-rename"]
  ): void => {
    let relocation: AssetRelocation | null;
    try {
      relocation = this._model.renameOf(event.detail.id, event.detail.name);
    }
    catch (error) {
      this.#error(reasonOf(error));

      return;
    }
    if (relocation !== null) {
      void this.#relocate([relocation], "rename");
    }
  };

  readonly #onReparent = (
    event: HTMLElementEventMap["jolly-reparent"]
  ): void => {
    const relocations = this._model.movesOf(event.detail);
    if (relocations.length > 0) {
      void this.#relocate(relocations, "move");
    }
  };

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (event.key === "Delete") {
      event.preventDefault();
      this.#deleteSelected();
    }
  };

  readonly #beginRename = (): void => {
    const [nodeId] = this._selected;
    if (nodeId !== undefined) {
      this._tree?.beginRename(nodeId);
    }
  };

  readonly #deleteSelected = (): void => {
    const [nodeId] = this._selected;
    if (nodeId !== undefined) {
      void this.#delete(nodeId);
    }
  };
}

function relocationFailure(
  verb: RelocationVerb,
  relocation: AssetRelocation,
  applied: number,
  error: unknown
): string {
  const reason = reasonOf(error);
  const total = relocation.renames.length;
  const name = relocation.from.name;
  if (total > 1 && applied > 0) {
    const done = verb === "rename" ? "Renamed" : "Moved";

    return `${done} ${applied} of ${total} assets under "${name}": ${reason}`;
  }
  if (verb === "rename") {
    return `Could not rename "${name}" to "${relocation.to.name}": ${reason}`;
  }

  const folder = relocation.to.parent;

  return `Could not move "${name}" to ${folder.isRoot ? kProjectRoot : `"${folder}"`}: ${reason}`;
}

function reasonOf(
  error: unknown
): string {
  return error instanceof Error ? error.message : String(error);
}

function download(
  blob: Blob,
  fileName: string
): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

declare global {
  interface HTMLElementTagNameMap {
    "asset-browser": AssetBrowser;
  }

  interface HTMLElementEventMap {
    "asset-open": CustomEvent<AssetOpenDetail>;
    "asset-error": CustomEvent<AssetErrorDetail>;
  }
}
