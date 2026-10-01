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
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import {
  LocalStorageAdapter,
  type JollyChangeDetail,
  type JollyOption,
  type JollyReparentDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { AssetKindSet } from "../../catalog/AssetKindSet.ts";
import { AssetPath } from "../../catalog/AssetPath.ts";
import {
  AssetTreeModel,
  folderNodeId,
  type AssetLeafData,
  type AssetNodeData,
  type AssetRelocation
} from "../../catalog/AssetTreeModel.ts";
import { DraftFolders } from "../../catalog/DraftFolders.ts";
import {
  AssetCommands,
  type RelocationVerb
} from "./AssetCommands.ts";
import type { AssetDeleteDialog } from "./AssetDeleteDialog.ts";
import "./AssetDeleteDialog.ts";

// CONSTANTS
const kKindStorageKey = "studio:asset-kind";
const kNewFolderName = "New folder";
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
  declare _drafts: DraftFolders;

  @state()
  declare _kind: string;

  @query("jolly-tree")
  declare _tree: HTMLElementTagNameMap["jolly-tree"] | null;

  @query("asset-delete-dialog")
  declare _deleteDialog: AssetDeleteDialog;

  #catalog: CatalogClient | null = null;
  #commands: AssetCommands | null = null;
  #storage = new LocalStorageAdapter();

  constructor() {
    super();
    this.options = null;
    this._model = AssetTreeModel.EMPTY;
    this._expanded = null;
    this._selected = [];
    this._pendingLabels = new Map();
    this._drafts = DraftFolders.EMPTY;
    this._kind = this.#storage.get(kKindStorageKey) ?? "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#listen();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unlisten();
    this.#catalog = null;
    this.#commands = null;
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
    else if (changed.has("_kind") || changed.has("_drafts")) {
      this.#rebuild();
    }
  }

  override render(): TemplateResult {
    const empty = this._selected.length === 0;
    const single = this._selected.length === 1;
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
          icon="new-folder"
          icon-only
          label="New folder"
          title="New folder"
          @click=${this.#newFolder}
        ></jolly-button>
        <jolly-button
          icon="pencil"
          icon-only
          label="Rename"
          title="Rename (F2)"
          ?disabled=${!single}
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
        multiple
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

    this.#unlisten();
    this.#catalog = catalog;
    this.#commands = catalog === null ? null : new AssetCommands({
      catalog,
      onError: (message) => this.#error(message)
    });
    this.#catalog?.on("change", this.#rebuild);
    this.#catalog?.on("dependencies", this.#rebuild);
    this.#rebuild();
  }

  #unlisten(): void {
    this.#catalog?.off("change", this.#rebuild);
    this.#catalog?.off("dependencies", this.#rebuild);
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
    const commands = this.#commands;
    if (commands === null) {
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
    this._drafts = this._drafts.rebased(relocations);

    const failed = await commands.relocate(relocations, verb);
    if (failed !== null) {
      const restored = new Map(this._pendingLabels);
      restored.delete(failed.nodeId);
      this._pendingLabels = restored;
      this._drafts = this._drafts.rebased([{
        from: failed.to,
        to: failed.from
      }]);
    }
  }

  async #delete(
    nodeIds: readonly string[]
  ): Promise<void> {
    const commands = this.#commands;
    if (commands === null) {
      return;
    }

    const deletion = this._model.deletionOf(nodeIds);
    if (deletion.isEmpty) {
      this._drafts = this._drafts.without(deletion.folders);

      return;
    }

    const confirmation = await this._deleteDialog.open(deletion);
    if (confirmation === null) {
      return;
    }

    this._drafts = this._drafts.without(deletion.folders);
    await commands.remove(deletion, confirmation.companions);
  }

  #selectedData(): AssetNodeData | undefined {
    const [nodeId] = this._selected;

    return nodeId === undefined ? undefined : this._model.node(nodeId)?.data;
  }

  #selectedAsset(): AssetLeafData | null {
    const data = this._selected.length === 1 ? this.#selectedData() : undefined;

    return data?.type === "asset" ? data : null;
  }

  #selectedFolder(): AssetPath {
    const data = this.#selectedData();
    if (data === undefined) {
      return AssetPath.ROOT;
    }

    return data.type === "folder" ? data.path : data.path.parent;
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

  #plan<T>(
    plan: () => T
  ): T | null {
    try {
      return plan();
    }
    catch (error) {
      this.#error(error instanceof Error ? error.message : String(error));

      return null;
    }
  }

  #error(
    message: string
  ): void {
    this.dispatchEvent(new CustomEvent<AssetErrorDetail>("asset-error", {
      bubbles: true,
      detail: { message }
    }));
  }

  readonly #rebuild = (): void => {
    const records = [...this.#catalog?.records() ?? []];
    this._drafts = this._drafts.unpopulated(
      records.map((record) => AssetPath.parse(record.source))
    );

    const kinds = this.#kinds;
    const model = new AssetTreeModel(records, {
      presenter: kinds,
      kind: kinds.has(this._kind) ? this._kind : null,
      dependencies: this.#catalog?.dependencies,
      folders: this._drafts
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

  readonly #newFolder = async(): Promise<void> => {
    const parent = this.#selectedFolder();
    const path = this._model.vacantFolder(parent, kNewFolderName);
    const nodeId = folderNodeId(path);
    this._drafts = this._drafts.with(path);
    if (!parent.isRoot) {
      this.#toggle(folderNodeId(parent), true);
    }
    this._selected = [nodeId];

    await this.updateComplete;
    await this._tree?.updateComplete;
    this._tree?.beginRename(nodeId);
  };

  readonly #exportSelected = (): void => {
    const asset = this.#selectedAsset();
    if (asset !== null) {
      void this.#commands?.export(asset);
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
    const relocation = this.#plan(
      () => this._model.renameOf(event.detail.id, event.detail.name)
    );
    if (relocation !== null) {
      void this.#relocate([relocation], "rename");
    }
  };

  readonly #onReparent = (
    event: HTMLElementEventMap["jolly-reparent"]
  ): void => {
    const relocations = this.#plan(() => this._model.movesOf(event.detail)) ?? [];
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
    if (this._selected.length > 0) {
      void this.#delete(this._selected);
    }
  };
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
