// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type {
  JollyOption,
  JollyReparentDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetDeletion } from "../../catalog/AssetDeletion.ts";
import {
  AssetDrop,
  MAX_DROPPED_FILE_MB,
  type ConversionChoice,
  type ConvertibleFiles
} from "../../catalog/AssetDrop.ts";
import type {
  AssetKindEntry,
  AssetKindSet
} from "../../catalog/AssetKindSet.ts";
import { AssetPath } from "../../catalog/AssetPath.ts";
import {
  AssetSelection,
  type AssetAction
} from "../../catalog/AssetSelection.ts";
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
import { DroppedFile } from "../../browser/DroppedFile.ts";
import type { BrowserState } from "../../browser/BrowserState.ts";
import {
  AssetCommands,
  type AssetCommandCatalog,
  type ConflictQuestion,
  type RelocationVerb
} from "./AssetCommands.ts";

// CONSTANTS
const kNewFolderName = "New folder";
const kMaxReplaceBytes = MAX_DROPPED_FILE_MB * 1024 * 1024;
const kAllKinds: JollyOption<string> = {
  value: "",
  label: "All kinds",
  icon: "all-kinds"
};

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

export type AssetTreeState = Pick<
  BrowserState,
  "assetKind" | "expandedFolders"
>;

export interface AssetDeleteChoice {
  companions: boolean;
}

export interface AssetDropQuestions {
  conversion(
    files: ConvertibleFiles
  ): Promise<ConversionChoice | null>;
  conflicts: ConflictQuestion;
}

export interface AssetActionPrompts {
  open(assetId: string): void;
  rename(nodeId: string): void;
  /**
   * `null` when the studio cannot open share links, which hides the action.
   */
  share: ((asset: AssetLeafData) => void) | null;
  confirmDelete(deletion: AssetDeletion): Promise<AssetDeleteChoice | null>;
  pickFile(accept: readonly string[]): Promise<File | null>;
}

export interface AssetTreeViewOptions {
  catalog: AssetTreeCatalog;
  kinds: AssetKindSet;
  browserState: AssetTreeState;
  /**
   * What the actions need from the page: dialogs, inline rename, opening.
   */
  prompts: AssetActionPrompts;
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
  #browserState: AssetTreeState;
  #prompts: AssetActionPrompts;
  #commands: AssetCommands;
  #onChange: () => void;
  #onError: (message: string) => void;
  #onCreated: (nodeId: string) => void;
  #model = AssetTreeModel.EMPTY;
  #nodes: AssetTreeNode[] = AssetTreeModel.EMPTY.nodes;
  #layout = CatalogLayout.EMPTY;
  #kind: string;
  #kindOptions: readonly JollyOption<string>[] = [kAllKinds];
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
    this.#browserState = options.browserState;
    this.#prompts = options.prompts;
    this.#onChange = options.onChange;
    this.#onError = options.onError;
    this.#onCreated = options.onCreated;
    this.#commands = new AssetCommands({
      catalog: options.catalog,
      onError: options.onError
    });
    this.#kind = options.browserState.assetKind;
    this.#expanded = options.browserState.expandedFolders;
    this.#catalog.on("change", this.#onCatalogChange);
    this.#catalog.on("dependencies", this.#onDependenciesChange);
    this.refresh();
  }

  get sharing(): boolean {
    return this.#prompts.share !== null;
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

  get kindOptions(): readonly JollyOption<string>[] {
    return this.#kindOptions;
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
    this.#browserState.assetKind = kind;
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
    const relocation = this.#plan(() => this.#model.planRename(nodeId, name));
    if (relocation !== null) {
      await this.#relocate([relocation], "rename");
    }
  }

  async move(
    detail: JollyReparentDetail
  ): Promise<void> {
    const relocations = this.#plan(() => this.#model.planMoves(detail)) ?? [];
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
    const entry = this.#kinds.findEntry(kind);
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

  allows(
    action: AssetAction,
    nodeIds?: Iterable<string>
  ): boolean {
    return (action !== "share" || this.sharing) &&
      this.selection(nodeIds).allows(action);
  }

  run(
    action: AssetAction,
    nodeIds?: Iterable<string>
  ): void {
    const selection = this.selection(nodeIds);
    if (!this.allows(action, selection.nodeIds)) {
      return;
    }

    const { asset, folder } = selection;
    switch (action) {
      case "open":
        if (asset !== null) {
          this.#prompts.open(asset.id);
        }
        break;
      case "new-folder":
        void this.createFolder(folder);
        break;
      case "rename":
        this.#prompts.rename(selection.nodeIds[0]);
        break;
      case "replace":
        if (asset !== null) {
          void this.#replace(asset);
        }
        break;
      case "export":
        if (asset !== null) {
          void this.#commands.export(asset);
        }
        break;
      case "share":
        if (asset !== null) {
          this.#prompts.share?.(asset);
        }
        break;
      case "delete":
        void this.#remove(selection.nodeIds);
        break;
      default: {
        const unhandled: never = action;
        throw new Error(`Unhandled asset action: ${unhandled}`);
      }
    }
  }

  async #replace(
    asset: AssetLeafData
  ): Promise<void> {
    const entry = this.#kinds.findEntry(asset.kind);
    const picked = await this.#prompts.pickFile([
      asset.path.extension,
      ...entry?.convertsFrom ?? []
    ]);
    if (picked === null) {
      return;
    }

    const file = new DroppedFile(picked);
    if (file.size > kMaxReplaceBytes) {
      this.#onError(
        `Could not replace "${asset.path.name}": "${file.name}" is larger than ${MAX_DROPPED_FILE_MB} MB`
      );

      return;
    }

    await this.#commands.replace(asset, file, entry);
  }

  async #remove(
    nodeIds: readonly string[]
  ): Promise<void> {
    const deletion = this.#model.planDeletion(nodeIds);
    if (deletion.isEmpty) {
      await this.#commands.remove(deletion, false);

      return;
    }

    const choice = await this.#prompts.confirmDelete(deletion);
    if (choice !== null) {
      await this.#commands.remove(deletion, choice.companions);
    }
  }

  async importFiles(
    folder: AssetPath,
    files: Iterable<File>,
    questions: AssetDropQuestions
  ): Promise<void> {
    const drop = new AssetDrop(files, this.#kinds);
    for (const file of drop.oversized) {
      this.#onError(
        `Could not add "${file.name}": it is larger than ${MAX_DROPPED_FILE_MB} MB`
      );
    }
    for (const archive of drop.archives) {
      if (!await this.#commands.importArchive(archive, questions.conflicts)) {
        await this.#commands.add(folder, archive);
      }
    }
    for (const group of drop.convertible) {
      const choice = await questions.conversion(group);
      if (choice !== null) {
        await this.#addAll(folder, group.files, choice.convertTo);
      }
    }
    await this.#addAll(folder, drop.files);
    this.#expandFolder(folder);
  }

  dispose(): void {
    this.#catalog.off("change", this.#onCatalogChange);
    this.#catalog.off("dependencies", this.#onDependenciesChange);
  }

  #expand(
    expanded: ReadonlySet<string>
  ): void {
    this.#expanded = expanded;
    this.#browserState.expandedFolders = expanded;
    this.#onChange();
  }

  #expandFolder(
    folder: AssetPath
  ): void {
    if (!folder.isRoot) {
      this.toggle(folderNodeId(folder), true);
    }
  }

  async #addAll(
    folder: AssetPath,
    files: readonly DroppedFile[],
    convertTo: AssetKindEntry | null = null
  ): Promise<void> {
    await Promise.all(
      files.map((file) => this.#commands.add(folder, file, convertTo))
    );
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

    const shownKinds = new Set(records.map((record) => record.kind));
    shownKinds.add(this.#kind);
    this.#kindOptions = [
      kAllKinds,
      ...this.#kinds.toOptions().filter(
        (option) => shownKinds.has(option.value)
      )
    ];

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
