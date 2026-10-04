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
import {
  AssetKindSet,
  type AssetKindEntry
} from "../../catalog/AssetKindSet.ts";
import { AssetPath } from "../../catalog/AssetPath.ts";
import { CatalogLayout } from "../../catalog/CatalogLayout.ts";
import {
  AssetSelection,
  isAssetAction,
  newAssetKindOf,
  type AssetAction
} from "../../catalog/AssetSelection.ts";
import {
  AssetTreeModel,
  assetNodeId,
  folderNodeId,
  type AssetRelocation,
  type AssetTreeNode
} from "../../catalog/AssetTreeModel.ts";
import {
  AssetCommands,
  type RelocationVerb
} from "./AssetCommands.ts";
import type { AssetDeleteDialog } from "./AssetDeleteDialog.ts";
import {
  assetMenu,
  newAssetMenu
} from "./assetMenu.ts";
import "./AssetDeleteDialog.ts";

// CONSTANTS
const kKindStorageKey = "studio:asset-kind";
const kExpandedStorageKey = "studio:asset-expanded";
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
  declare _expanded: ReadonlySet<string>;

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

  @query("jolly-context-menu")
  declare _menu: HTMLElementTagNameMap["jolly-context-menu"];

  @query(".new-asset")
  declare _newAssetButton: HTMLElement;

  #catalog: CatalogClient | null = null;
  #commands: AssetCommands | null = null;
  #storage = new LocalStorageAdapter();
  #menuTarget: AssetSelection | null = null;
  #created: string | null = null;
  #layout = CatalogLayout.EMPTY;
  #catalogChanged = false;
  #modelStale = true;
  #kindOptions: JollyOption<string>[] = [kAllKinds];
  #nodes: AssetTreeNode[] = AssetTreeModel.EMPTY.nodes;

  constructor() {
    super();
    this.options = null;
    this._model = AssetTreeModel.EMPTY;
    this._expanded = new Set(
      nodeIdsOf(this.#storage.get(kExpandedStorageKey))
    );
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
    if (changed.has("_expanded")) {
      this.#storage.set(
        kExpandedStorageKey,
        JSON.stringify([...this._expanded])
      );
    }
    if (changed.has("options")) {
      this.#listen();
      this.#kindOptions = [kAllKinds, ...this.#kinds.toOptions()];
    }
    if (
      changed.has("options") ||
      changed.has("_kind") ||
      this.#layoutChanged()
    ) {
      this.#modelStale = true;
    }
    if (this.#modelStale) {
      this.#rebuild();
    }
    if (changed.has("_model") || changed.has("_pendingLabels")) {
      this.#nodes = this._model.withLabels(this._pendingLabels);
    }
    this.#revealCreated();
  }

  override render(): TemplateResult {
    const selection = this.#selection();

    return html`
      <jolly-button-group
        class="kinds"
        icon-only
        aria-label="Asset kind"
        .options=${this.#kindOptions}
        .value=${this._kind}
        @jolly-change=${this.#onKindChange}
      ></jolly-button-group>
      <jolly-toolbar label="Asset actions">
        <jolly-button
          class="new-asset"
          icon="plus"
          icon-only
          label="New asset"
          title="New asset"
          ?disabled=${this.#kinds.entries.length === 0}
          @click=${this.#openNewAssetMenu}
        ></jolly-button>
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
          ?disabled=${!selection.allows("rename")}
          @click=${this.#beginRename}
        ></jolly-button>
        <jolly-button
          icon="trash"
          icon-only
          variant="danger"
          label="Delete"
          title="Delete (Del)"
          ?disabled=${!selection.allows("delete")}
          @click=${this.#deleteSelected}
        ></jolly-button>
        <jolly-button
          icon="export"
          icon-only
          label="Export"
          title="Export as a ZIP archive"
          ?disabled=${!selection.allows("export")}
          @click=${this.#exportSelected}
        ></jolly-button>
      </jolly-toolbar>
      <jolly-tree
        virtual
        multiple
        renamable
        reorderable
        row-drag
        activate-on-double-click
        indent-guides
        .nodes=${this.#nodes}
        .expanded=${[...this._expanded]}
        .selected=${this._selected}
        .acceptDrop=${this.#acceptDrop}
        @jolly-select=${this.#onSelect}
        @jolly-toggle-expand=${this.#onToggleExpand}
        @jolly-activate=${this.#onActivate}
        @jolly-rename=${this.#onRename}
        @jolly-reparent=${this.#onReparent}
        @jolly-context-request=${this.#onContextRequest}
        @keydown=${this.#onKeyDown}
      ></jolly-tree>
      <jolly-context-menu
        label="Asset actions"
        @jolly-context-action=${this.#onContextAction}
      ></jolly-context-menu>
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
    this.#catalog?.on("change", this.#onCatalogChange);
    this.#catalog?.on("dependencies", this.#onDependenciesChange);
    this.#modelStale = true;
    this.requestUpdate();
  }

  #unlisten(): void {
    this.#catalog?.off("change", this.#onCatalogChange);
    this.#catalog?.off("dependencies", this.#onDependenciesChange);
  }

  #layoutChanged(): boolean {
    if (!this.#catalogChanged) {
      return false;
    }
    this.#catalogChanged = false;

    return !this.#layout.matches(
      this.#catalog?.records() ?? [],
      this.#catalog?.folders() ?? []
    );
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

    const failed = await commands.relocate(relocations, verb);
    if (failed !== null) {
      const restored = new Map(this._pendingLabels);
      restored.delete(failed.nodeId);
      this._pendingLabels = restored;
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
      await commands.remove(deletion, false);

      return;
    }

    const confirmation = await this._deleteDialog.open(deletion);
    if (confirmation !== null) {
      await commands.remove(deletion, confirmation.companions);
    }
  }

  #selection(
    nodeIds: Iterable<string> = this._selected
  ): AssetSelection {
    return new AssetSelection(this._model, nodeIds);
  }

  #run(
    action: AssetAction,
    target: AssetSelection
  ): void {
    const selection = this.#selection(target.nodeIds);
    if (!selection.allows(action)) {
      return;
    }

    const { asset, folder, nodeIds } = selection;
    switch (action) {
      case "open":
        if (asset !== null) {
          this.#open(asset.id);
        }
        break;
      case "new-folder":
        void this.#newFolderIn(folder);
        break;
      case "rename":
        this._tree?.beginRename(nodeIds[0]);
        break;
      case "export":
        if (asset !== null) {
          void this.#commands?.export(asset);
        }
        break;
      case "delete":
        void this.#delete(nodeIds);
        break;
      default:
        break;
    }
  }

  #open(
    assetId: string
  ): void {
    this.dispatchEvent(new CustomEvent<AssetOpenDetail>("asset-open", {
      bubbles: true,
      detail: { assetId }
    }));
  }

  async #newFolderIn(
    parent: AssetPath
  ): Promise<void> {
    const path = this._model.vacantFolder(parent, kNewFolderName);
    const created = await this.#commands?.createFolder(path) ?? false;
    if (!created) {
      return;
    }

    const nodeId = folderNodeId(path);
    if (!parent.isRoot) {
      this.#toggle(folderNodeId(parent), true);
    }
    this._selected = [nodeId];

    await this.#beginRenameOf(nodeId);
  }

  #newAsset(
    kind: string,
    target: AssetSelection
  ): void {
    const entry = this.#kinds.entryOf(kind);
    if (entry !== undefined) {
      void this.#newAssetIn(this.#selection(target.nodeIds).folder, entry);
    }
  }

  async #newAssetIn(
    folder: AssetPath,
    entry: AssetKindEntry
  ): Promise<void> {
    const assetId = await this.#commands?.create(folder, entry) ?? null;
    if (assetId === null) {
      return;
    }

    if (!folder.isRoot) {
      this.#toggle(folderNodeId(folder), true);
    }
    this.#created = assetId;
    this.requestUpdate();
  }

  #revealCreated(): void {
    const assetId = this.#created;
    if (assetId === null) {
      return;
    }

    const nodeId = assetNodeId(assetId);
    if (!this._model.has(nodeId)) {
      if (this.#catalog?.record(assetId) !== undefined) {
        this.#created = null;
      }

      return;
    }

    this.#created = null;
    this._selected = [nodeId];
    void this.#beginRenameOf(nodeId);
  }

  async #beginRenameOf(
    nodeId: string
  ): Promise<void> {
    await this.updateComplete;
    await this._tree?.updateComplete;
    this._tree?.beginRename(nodeId);
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
    this._expanded = new Set([
      ...this._expanded,
      ...[...this._expanded].map(rebase)
    ]);
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

  #rebuild(): void {
    const records = [...this.#catalog?.records() ?? []];
    const folderNames = [...this.#catalog?.folders() ?? []];
    const folders = folderNames.map((folder) => AssetPath.parse(folder));
    this.#layout = new CatalogLayout(records, folderNames);
    this.#modelStale = false;

    const kinds = this.#kinds;
    const model = new AssetTreeModel(records, {
      presenter: kinds,
      kind: kinds.has(this._kind) ? this._kind : null,
      dependencies: this.#catalog?.dependencies,
      folders
    });
    this._model = model;
    this._selected = this._selected.filter((nodeId) => model.has(nodeId));

    const labels = new Map(this._pendingLabels);
    for (const [nodeId, label] of labels) {
      const current = model.node(nodeId);
      if (current === undefined || current.label === label) {
        labels.delete(nodeId);
      }
    }
    this._pendingLabels = labels;
  }

  readonly #onCatalogChange = (): void => {
    this.#catalogChanged = true;
    this.requestUpdate();
  };

  readonly #onDependenciesChange = (): void => {
    this.#modelStale = true;
    this.requestUpdate();
  };

  readonly #onKindChange = (
    event: CustomEvent<JollyChangeDetail<string>>
  ): void => {
    this._kind = event.detail.value;
    this.#storage.set(kKindStorageKey, this._kind);
  };

  readonly #newFolder = (): void => {
    this.#run("new-folder", this.#selection());
  };

  readonly #exportSelected = (): void => {
    this.#run("export", this.#selection());
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
      this.#toggle(nodeId, !this._expanded.has(nodeId));
    }
    else if (data?.type === "asset") {
      this.#open(data.id);
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

  readonly #onContextRequest = (
    event: HTMLElementEventMap["jolly-context-request"]
  ): void => {
    const { id, x, y } = event.detail;
    const target = this.#selection(id === null ? [] : this._selected);
    this.#menuTarget = target;
    this._menu.items = assetMenu(target, this.#kinds);
    this._menu.openAt(x, y);
  };

  readonly #openNewAssetMenu = (): void => {
    const anchor = this._newAssetButton.getBoundingClientRect();
    this.#menuTarget = this.#selection();
    this._menu.items = newAssetMenu(this.#kinds);
    this._menu.openAt(anchor.left, anchor.bottom);
  };

  readonly #onContextAction = (
    event: HTMLElementEventMap["jolly-context-action"]
  ): void => {
    const target = this.#menuTarget;
    const action = event.detail.id;
    this.#menuTarget = null;
    if (target === null) {
      return;
    }

    const kind = newAssetKindOf(action);
    if (kind !== null) {
      this.#newAsset(kind, target);
    }
    else if (isAssetAction(action)) {
      this.#run(action, target);
    }
  };

  readonly #beginRename = (): void => {
    this.#run("rename", this.#selection());
  };

  readonly #deleteSelected = (): void => {
    this.#run("delete", this.#selection());
  };
}

function nodeIdsOf(
  stored: string | null
): string[] {
  try {
    const nodeIds: unknown = JSON.parse(stored ?? "[]");

    return Array.isArray(nodeIds) ?
      nodeIds.filter((nodeId) => typeof nodeId === "string") :
      [];
  }
  catch {
    return [];
  }
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
