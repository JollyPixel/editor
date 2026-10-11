// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { JollyReparentDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetDeletion } from "../../catalog/AssetDeletion.ts";
import type { AssetKindSet } from "../../catalog/AssetKindSet.ts";
import { AssetPath } from "../../catalog/AssetPath.ts";
import { AssetSelection } from "../../catalog/AssetSelection.ts";
import { CatalogLayout } from "../../catalog/CatalogLayout.ts";
import {
  AssetTreeModel,
  assetNodeId,
  folderNodeId,
  type AssetDependencies,
  type AssetLeafData,
  type AssetRelocation,
  type AssetTreeNode
} from "../../catalog/AssetTreeModel.ts";
import type { StudioPreferences } from "../../preferences/StudioPreferences.ts";
import {
  AssetCommands,
  type AssetCommandCatalog,
  type RelocationVerb
} from "./AssetCommands.ts";

// CONSTANTS
const kNewFolderName = "New folder";

export type AssetTreeCatalogEvent = "change" | "dependencies";

export interface AssetTreeCatalog extends AssetCommandCatalog {
  readonly dependencies: AssetDependencies;
  records(): Iterable<AssetRecordData>;
  folders(): Iterable<string>;
  record(
    assetId: string
  ): AssetRecordData | undefined;
  on(
    event: AssetTreeCatalogEvent,
    listener: () => void
  ): unknown;
  off(
    event: AssetTreeCatalogEvent,
    listener: () => void
  ): unknown;
}

export type AssetTreePreferences = Pick<
  StudioPreferences,
  "assetKind" | "expandedFolders"
>;

export interface AssetDeleteChoice {
  companions: boolean;
}

export interface AssetTreeViewOptions {
  catalog: AssetTreeCatalog;
  kinds: AssetKindSet;
  preferences: AssetTreePreferences;
  onChange: () => void;
  onError: (message: string) => void;
  /**
   * Called once a created asset or folder shows in the tree, selected.
   */
  onCreated: (nodeId: string) => void;
}

export class AssetTreeView {
  #catalog: AssetTreeCatalog;
  #kinds: AssetKindSet;
  #preferences: AssetTreePreferences;
  #commands: AssetCommands;
  #onChange: () => void;
  #onError: (message: string) => void;
  #onCreated: (nodeId: string) => void;
  #model = AssetTreeModel.EMPTY;
  #nodes: AssetTreeNode[] = AssetTreeModel.EMPTY.nodes;
  #layout = CatalogLayout.EMPTY;
  #kind: string;
  #expanded: ReadonlySet<string>;
  #selected: readonly string[] = [];
  #pendingLabels: ReadonlyMap<string, string> = new Map();
  #created: string | null = null;
  #catalogChanged = false;
  #stale = true;

  constructor(
    options: AssetTreeViewOptions
  ) {
    this.#catalog = options.catalog;
    this.#kinds = options.kinds;
    this.#preferences = options.preferences;
    this.#onChange = options.onChange;
    this.#onError = options.onError;
    this.#onCreated = options.onCreated;
    this.#commands = new AssetCommands({
      catalog: options.catalog,
      onError: options.onError
    });
    this.#kind = options.preferences.assetKind;
    this.#expanded = options.preferences.expandedFolders;
    this.#catalog.on("change", this.#onCatalogChange);
    this.#catalog.on("dependencies", this.#onDependenciesChange);
    this.refresh();
  }

  get model(): AssetTreeModel {
    return this.#model;
  }

  get nodes(): readonly AssetTreeNode[] {
    return this.#nodes;
  }

  get kind(): string {
    return this.#kind;
  }

  get expanded(): ReadonlySet<string> {
    return this.#expanded;
  }

  get selected(): readonly string[] {
    return this.#selected;
  }

  selection(
    nodeIds: Iterable<string> = this.#selected
  ): AssetSelection {
    return new AssetSelection(this.#model, nodeIds);
  }

  refresh(): void {
    if (this.#catalogChanged) {
      this.#catalogChanged = false;
      this.#stale ||= !this.#layout.matches(
        this.#catalog.records(),
        this.#catalog.folders()
      );
    }
    if (this.#stale) {
      this.#rebuild();
    }
    this.#revealCreated();
  }

  filter(
    kind: string
  ): void {
    this.#kind = kind;
    this.#preferences.assetKind = kind;
    this.#stale = true;
    this.#onChange();
  }

  toggle(
    nodeId: string,
    expanded = !this.#expanded.has(nodeId)
  ): void {
    const next = new Set(this.#expanded);
    if (expanded) {
      next.add(nodeId);
    }
    else {
      next.delete(nodeId);
    }
    this.#expand(next);
  }

  select(
    nodeIds: Iterable<string>
  ): void {
    this.#selected = [...nodeIds].filter((nodeId) => this.#model.has(nodeId));
    this.#onChange();
  }

  acceptsDrop(
    detail: JollyReparentDetail
  ): boolean {
    return this.#model.acceptsDrop(detail);
  }

  async rename(
    nodeId: string,
    name: string
  ): Promise<void> {
    const relocation = this.#plan(() => this.#model.renameOf(nodeId, name));
    if (relocation !== null) {
      await this.#relocate([relocation], "rename");
    }
  }

  async move(
    detail: JollyReparentDetail
  ): Promise<void> {
    const relocations = this.#plan(() => this.#model.movesOf(detail)) ?? [];
    if (relocations.length > 0) {
      await this.#relocate(relocations, "move");
    }
  }

  async createFolder(
    parent: AssetPath
  ): Promise<void> {
    const path = this.#model.vacantFolder(parent, kNewFolderName);
    if (!await this.#commands.createFolder(path)) {
      return;
    }

    const nodeId = folderNodeId(path);
    this.#expandFolder(parent);
    this.#selected = [nodeId];
    this.#onChange();
    this.#onCreated(nodeId);
  }

  async createAsset(
    kind: string,
    folder: AssetPath
  ): Promise<void> {
    const entry = this.#kinds.entryOf(kind);
    if (entry === undefined) {
      return;
    }

    const assetId = await this.#commands.create(folder, entry);
    if (assetId === null) {
      return;
    }

    this.#expandFolder(folder);
    this.#created = assetId;
    this.#onChange();
  }

  async remove(
    nodeIds: readonly string[],
    confirm: (deletion: AssetDeletion) => Promise<AssetDeleteChoice | null>
  ): Promise<void> {
    const deletion = this.#model.deletionOf(nodeIds);
    if (deletion.isEmpty) {
      await this.#commands.remove(deletion, false);

      return;
    }

    const choice = await confirm(deletion);
    if (choice !== null) {
      await this.#commands.remove(deletion, choice.companions);
    }
  }

  export(
    asset: AssetLeafData
  ): Promise<void> {
    return this.#commands.export(asset);
  }

  dispose(): void {
    this.#catalog.off("change", this.#onCatalogChange);
    this.#catalog.off("dependencies", this.#onDependenciesChange);
  }

  #expand(
    expanded: ReadonlySet<string>
  ): void {
    this.#expanded = expanded;
    this.#preferences.expandedFolders = expanded;
    this.#onChange();
  }

  #expandFolder(
    folder: AssetPath
  ): void {
    if (!folder.isRoot) {
      this.toggle(folderNodeId(folder), true);
    }
  }

  async #relocate(
    relocations: AssetRelocation[],
    verb: RelocationVerb
  ): Promise<void> {
    const labels = new Map(this.#pendingLabels);
    for (const relocation of relocations) {
      if (verb === "rename") {
        labels.set(relocation.nodeId, relocation.to.name);
      }
      this.#followFolder(relocation);
    }
    this.#pendingLabels = labels;
    this.#nodes = this.#model.withLabels(labels);
    this.#onChange();

    const failed = await this.#commands.relocate(relocations, verb);
    if (failed !== null) {
      const restored = new Map(this.#pendingLabels);
      restored.delete(failed.nodeId);
      this.#pendingLabels = restored;
      this.#nodes = this.#model.withLabels(restored);
      this.#onChange();
    }
  }

  #followFolder(
    relocation: AssetRelocation
  ): void {
    if (this.#model.node(relocation.nodeId)?.data?.type !== "folder") {
      return;
    }

    const rebase = (nodeId: string): string => {
      const folder = this.#model.node(nodeId)?.data;

      return folder?.type === "folder" ?
        folderNodeId(folder.path.rebase(relocation.from, relocation.to)) :
        nodeId;
    };
    this.#selected = this.#selected.map(rebase);
    this.#expand(new Set([
      ...this.#expanded,
      ...[...this.#expanded].map(rebase)
    ]));
  }

  #plan<T>(
    plan: () => T
  ): T | null {
    try {
      return plan();
    }
    catch (error) {
      this.#onError(error instanceof Error ? error.message : String(error));

      return null;
    }
  }

  #rebuild(): void {
    const records = [...this.#catalog.records()];
    const folderNames = [...this.#catalog.folders()];
    this.#layout = new CatalogLayout(records, folderNames);
    this.#stale = false;

    const model = new AssetTreeModel(records, {
      presenter: this.#kinds,
      kind: this.#kinds.has(this.#kind) ? this.#kind : null,
      dependencies: this.#catalog.dependencies,
      folders: folderNames.map((folder) => AssetPath.parse(folder))
    });
    this.#model = model;
    this.#selected = this.#selected.filter((nodeId) => model.has(nodeId));

    const labels = new Map(this.#pendingLabels);
    for (const [nodeId, label] of labels) {
      const current = model.node(nodeId);
      if (current === undefined || current.label === label) {
        labels.delete(nodeId);
      }
    }
    this.#pendingLabels = labels;
    this.#nodes = model.withLabels(labels);
  }

  #revealCreated(): void {
    const assetId = this.#created;
    if (assetId === null) {
      return;
    }

    const nodeId = assetNodeId(assetId);
    if (!this.#model.has(nodeId)) {
      if (this.#catalog.record(assetId) !== undefined) {
        this.#created = null;
      }

      return;
    }

    this.#created = null;
    this.#selected = [nodeId];
    this.#onCreated(nodeId);
  }

  readonly #onCatalogChange = (): void => {
    this.#catalogChanged = true;
    this.#onChange();
  };

  readonly #onDependenciesChange = (): void => {
    this.#stale = true;
    this.#onChange();
  };
}
