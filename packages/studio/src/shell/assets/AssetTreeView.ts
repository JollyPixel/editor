// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type {
  JollyOption,
  JollyReparentDetail,
  Notifier
} from "@jolly-pixel/ui";
import {
  errorMessage,
  formatBytes
} from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { AssetDeletion } from "../../catalog/AssetDeletion.ts";
import {
  AssetDrop,
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
import { PendingAssets } from "../../catalog/PendingAssets.ts";
import { DroppedFile } from "../../browser/DroppedFile.ts";
import type { BrowserState } from "../../browser/BrowserState.ts";
import { KIND_FILTER_CHANGE } from "../../project/StudioProjectSettings.ts";
import { KindFilter } from "../../../shared/KindFilter.ts";
import {
  AssetCommands,
  type AssetCommandCatalog,
  type ConflictQuestion,
  type RelocationVerb
} from "./AssetCommands.ts";
import { LARGE_FILE_BYTES } from "./fileSize.ts";

// CONSTANTS
const kNewFolderName = "New folder";
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

interface Upload {
  readonly file: DroppedFile;
  readonly convertTo: AssetKindEntry | null;
  readonly limit: number;
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
  confirmLargeFiles(files: readonly DroppedFile[]): Promise<boolean>;
  pickFile(accept: readonly string[]): Promise<File | null>;
}

export interface KindFilterSource extends EventTarget {
  readonly kindFilter: KindFilter;
}

export interface AssetTreeViewOptions {
  catalog: AssetTreeCatalog;
  kinds: AssetKindSet;
  /**
   * The project's kind filter; `null` offers every kind.
   */
  kindFilter: KindFilterSource | null;
  browserState: AssetTreeState;
  /**
   * What the actions need from the page: dialogs, inline rename, opening.
   */
  prompts: AssetActionPrompts;
  notifications: Notifier;
  onChange: () => void;
  onError: (message: string) => void;
  /**
   * Called once a created asset or folder shows in the tree, selected.
   */
  onCreated: (nodeId: string) => void;
  /**
   * Called once the first file of a drop shows in the tree as an asset.
   */
  onImported: (nodeId: string) => void;
}

export class AssetTreeView {
  #catalog: AssetTreeCatalog;
  #kinds: AssetKindSet;
  #kindFilter: KindFilterSource | null;
  #browserState: AssetTreeState;
  #prompts: AssetActionPrompts;
  #commands: AssetCommands;
  #notifications: Notifier;
  #onChange: () => void;
  #onError: (message: string) => void;
  #onCreated: (nodeId: string) => void;
  #onImported: (nodeId: string) => void;
  #model = AssetTreeModel.EMPTY;
  #nodes: AssetTreeNode[] = AssetTreeModel.EMPTY.nodes;
  #layout = CatalogLayout.EMPTY;
  #kind: string;
  #kindOptions: readonly JollyOption<string>[] = [kAllKinds];
  #recordKinds: ReadonlySet<string> = new Set();
  #expanded: ReadonlySet<string>;
  #selected: readonly string[] = [];
  #pendingLabels: ReadonlyMap<string, string> = new Map();
  #pendingAssets = new PendingAssets();
  #arrivals = new Map<string, (nodeId: string | null) => void>();
  #catalogChanged = false;
  #stale = true;

  constructor(
    options: AssetTreeViewOptions
  ) {
    this.#catalog = options.catalog;
    this.#kinds = options.kinds;
    this.#kindFilter = options.kindFilter;
    this.#browserState = options.browserState;
    this.#prompts = options.prompts;
    this.#onChange = options.onChange;
    this.#onError = options.onError;
    this.#onCreated = options.onCreated;
    this.#onImported = options.onImported;
    this.#notifications = options.notifications;
    this.#commands = new AssetCommands({
      catalog: options.catalog,
      notifications: options.notifications,
      onError: options.onError
    });
    this.#kind = options.browserState.assetKind;
    this.#expanded = options.browserState.expandedFolders;
    this.#catalog.on("change", this.#onCatalogChange);
    this.#catalog.on("dependencies", this.#onDependenciesChange);
    this.#kindFilter?.addEventListener(
      KIND_FILTER_CHANGE,
      this.#onKindFilterChange
    );
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
    this.#settleArrivals();
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
    this.#arrivals.set(assetId, (nodeId) => {
      if (nodeId !== null) {
        this.#selected = [nodeId];
        this.#onCreated(nodeId);
      }
    });
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

    const replacement: Upload = {
      file: new DroppedFile(picked),
      convertTo: null,
      limit: this.#kinds.contentLimit(entry)
    };
    const [upload] = await this.#admitted(
      [replacement],
      ({ file, limit }) => `Could not replace "${asset.path.name}": ` +
        `"${file.name}" is larger than ${formatBytes(limit)}`
    );
    if (upload !== undefined) {
      await this.#commands.replace(asset, upload.file, entry);
    }
  }

  #upload(
    file: DroppedFile,
    convertTo: AssetKindEntry | null
  ): Upload {
    return {
      file,
      convertTo,
      limit: this.#kinds.contentLimit(
        convertTo ?? this.#kinds.resolve(file.name)
      )
    };
  }

  async #admitted(
    uploads: readonly Upload[],
    refusal: (upload: Upload) => string
  ): Promise<readonly Upload[]> {
    const fitting: Upload[] = [];
    for (const upload of uploads) {
      if (upload.file.size > upload.limit) {
        this.#onError(refusal(upload));
      }
      else {
        fitting.push(upload);
      }
    }
    const large = fitting.filter(({ file }) => file.size > LARGE_FILE_BYTES);
    if (
      large.length === 0 ||
      await this.#prompts.confirmLargeFiles(large.map(({ file }) => file))
    ) {
      return fitting;
    }

    return fitting.filter((upload) => !large.includes(upload));
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
    const drop = new AssetDrop(
      Array.from(files, (file) => new DroppedFile(file)),
      this.#kinds
    );
    const uploads = drop.files.map((file) => this.#upload(file, null));
    for (const group of drop.convertible) {
      const choice = await questions.conversion(group);
      if (choice !== null) {
        uploads.push(...group.files.map(
          (file) => this.#upload(file, choice.convertTo)
        ));
      }
    }
    const admitted = await this.#admitted(
      [...uploads, ...drop.archives.map((file) => this.#upload(file, null))],
      ({ file, limit }) => `Could not add "${file.name}": ` +
        `it is larger than ${formatBytes(limit)}`
    );
    this.#expandFolder(folder);
    let revealed = false;
    const reveal = (nodeId: string): void => {
      if (!revealed) {
        revealed = true;
        this.#onImported(nodeId);
      }
    };

    const adding: Upload[] = [];
    for (const upload of admitted) {
      if (
        !drop.archives.includes(upload.file) ||
        !await this.#commands.importArchive(upload.file, questions.conflicts)
      ) {
        adding.push(upload);
      }
    }
    await this.#addAll(folder, adding, reveal);
  }

  dispose(): void {
    this.#catalog.off("change", this.#onCatalogChange);
    this.#catalog.off("dependencies", this.#onDependenciesChange);
    this.#kindFilter?.removeEventListener(
      KIND_FILTER_CHANGE,
      this.#onKindFilterChange
    );
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
    uploads: readonly Upload[],
    onShown: (nodeId: string) => void
  ): Promise<void> {
    const [first] = uploads;
    if (first === undefined) {
      return;
    }

    const total = uploads.length;
    const label = total === 1 ? `"${first.file.name}"` : `${total} files`;
    const adding = this.#notifications.notify({
      tone: "loading",
      title: `Adding ${label}`
    });
    let done = 0;
    const failures: string[] = [];
    await Promise.all(uploads.map(async(upload) => {
      let share = 0;
      function advance(
        next: number
      ): void {
        done += next - share;
        share = next;
        adding.update({ progress: done / total });
      }
      try {
        await this.#add(folder, upload, onShown, advance);
      }
      catch (error) {
        const reason = errorMessage(error);
        failures.push(
          total === 1 ? reason : `"${upload.file.name}": ${reason}`
        );
      }
      advance(1);
    }));

    const message = failures.join("\n");
    if (failures.length === 0) {
      adding.update({
        tone: "success",
        title: `Added ${label}`,
        progress: null
      });
    }
    else if (failures.length === total) {
      adding.update({
        tone: "error",
        title: `Could not add ${label}`,
        message,
        progress: null
      });
    }
    else {
      adding.update({
        tone: "warning",
        title: `Added ${total - failures.length} of ${total} files`,
        message,
        progress: null
      });
    }
  }

  async #add(
    folder: AssetPath,
    { file, convertTo }: Upload,
    onShown: (nodeId: string) => void,
    onProgress: (share: number) => void
  ): Promise<void> {
    const path = folder.child(
      convertTo === null ? file.name : `${file.stem}${convertTo.extension}`
    );
    const rowId = this.#pendingAssets.add(
      path,
      convertTo === null ? "Adding" : `Converting to ${convertTo.label}`
    );
    this.#present();

    let assetId: string;
    try {
      assetId = await this.#commands.add(path, file, convertTo, onProgress);
    }
    catch (error) {
      this.#pendingAssets.remove(rowId);
      this.#present();

      throw error;
    }

    this.#arrivals.set(assetId, (nodeId) => {
      this.#pendingAssets.remove(rowId);
      if (nodeId !== null) {
        onShown(nodeId);
      }
    });
    this.#onChange();
  }

  #present(): void {
    this.#nodes = this.#presented();
    this.#onChange();
  }

  #presented(): AssetTreeNode[] {
    return this.#model.present({
      labels: this.#pendingLabels,
      rows: this.#pendingAssets.rows
    });
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
    this.#present();

    const failed = await this.#commands.relocate(relocations, verb);
    if (failed !== null) {
      const restored = new Map(this.#pendingLabels);
      restored.delete(failed.nodeId);
      this.#pendingLabels = restored;
      this.#present();
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
      this.#onError(errorMessage(error));

      return null;
    }
  }

  #offerKinds(): void {
    const kindFilter = this.#kindFilter?.kindFilter ?? KindFilter.NONE;
    this.#kindOptions = [
      kAllKinds,
      ...this.#kinds.toOptions().filter(({ value }) => value === this.#kind || (
        this.#recordKinds.has(value) && kindFilter.shows(value)
      ))
    ];
  }

  #rebuild(): void {
    const records = [...this.#catalog.records()];
    const folderNames = [...this.#catalog.folders()];
    this.#layout = new CatalogLayout(records, folderNames);
    this.#stale = false;

    this.#recordKinds = new Set(records.map((record) => record.kind));
    this.#offerKinds();

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
    this.#nodes = this.#presented();
  }

  #settleArrivals(): void {
    const waiting = this.#arrivals.size;
    for (const [assetId, arrive] of this.#arrivals) {
      const nodeId = assetNodeId(assetId);
      const shown = this.#model.has(nodeId);
      if (shown || this.#catalog.record(assetId) !== undefined) {
        this.#arrivals.delete(assetId);
        arrive(shown ? nodeId : null);
      }
    }
    if (this.#arrivals.size !== waiting) {
      this.#nodes = this.#presented();
    }
  }

  readonly #onCatalogChange = (): void => {
    this.#catalogChanged = true;
    this.#onChange();
  };

  readonly #onDependenciesChange = (): void => {
    this.#stale = true;
    this.#onChange();
  };

  readonly #onKindFilterChange = (): void => {
    this.#offerKinds();
    this.#onChange();
  };
}
