// Import Third-party Dependencies
import {
  AssetId,
  AssetPath,
  type AssetRecordData,
  type AssetReferenceData
} from "@jolly-pixel/asset";
import type {
  CatalogClient,
  ImportConflictPolicy,
  ImportPlan,
  ImportReport
} from "@jolly-pixel/asset-server/client";
import { showConfirm } from "@jolly-pixel/ui/elements/dialog";

// Import Internal Dependencies
import { EditorLaunch } from "../launch/EditorLaunch.ts";
import type { LaunchNavigator } from "../launch/LaunchNavigator.ts";
import type { SessionArchive } from "./SessionArchive.ts";
import type { OfflineMode } from "../connection/OfflineMode.ts";
import { ArchiveRootError } from "./errors/ArchiveRootError.ts";
import { ArchiveImportDisabledError } from "./errors/ArchiveImportDisabledError.ts";
import { askImportConflictPolicy } from "./dialogs/askImportConflictPolicy.ts";

// CONSTANTS
const kArchiveExtension = ".zip";
const kArchiveAccept = ".zip,application/zip";
const kResetWarning = "Every asset stored in this browser is deleted. " +
  "Export what you want to keep first.";
const kDomArchiveBrowser: EditorArchiveBrowser = {
  get location() {
    return globalThis.location;
  },
  pickFile(accept) {
    const { promise, resolve } = Promise.withResolvers<File | null>();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => {
      resolve(input.files?.[0] ?? null);
    }, { once: true });
    input.addEventListener("cancel", () => {
      resolve(null);
    }, { once: true });
    input.click();

    return promise;
  },
  save(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  askConflictPolicy: askImportConflictPolicy,
  confirmReset(message) {
    return showConfirm({
      title: "Reset offline data",
      message,
      confirmLabel: "Reset",
      danger: true
    });
  }
};

export interface EditorArchiveTarget {
  readonly id: string;
  readonly path: string;
}

export interface EditorDependencyFormat {
  readonly kind: string;
  /**
   * Extension of a single asset file, such as `".blockset.json"`.
   */
  readonly extension: string;
  /**
   * Folder a single asset file is created in, such as `"blocksets/"`.
   */
  readonly folder: string;
}

export type EditorDependencyLink = (
  reference: AssetReferenceData
) => void;

export interface EditorArchiveBrowser {
  readonly location: Pick<Location, "href" | "assign" | "reload">;
  pickFile(
    accept: string
  ): Promise<File | null>;
  save(
    blob: Blob,
    fileName: string
  ): void;
  askConflictPolicy(
    plan: ImportPlan
  ): Promise<ImportConflictPolicy | null>;
  confirmReset(
    message: string
  ): Promise<boolean>;
}

export interface EditorArchiveLabels {
  /**
   * Download name, without extension, when the target path has no stem.
   * @default accepts
   */
  fallbackName?: string;
  /**
   * What a reset deletes, shown before the user confirms it.
   */
  resetWarning?: string;
}

export type EditorArchiveCatalog = Pick<
  CatalogClient,
  | "record"
  | "create"
  | "dependencies"
>;

export interface EditorArchiveSession {
  readonly archive: SessionArchive;
  readonly offline: OfflineMode | null;
  readonly targetRecord: EditorArchiveTarget;
  readonly catalog: EditorArchiveCatalog;
}

interface AcceptedDependency {
  readonly format: EditorDependencyFormat;
  readonly link: EditorDependencyLink;
}

export interface EditorArchivesOptions extends EditorArchiveLabels {
  session: EditorArchiveSession;
  /**
   * Asset kind the editor opens; other archive roots need `acceptDependency()`.
   */
  accepts: string;
  navigator: LaunchNavigator;
  /**
   * @default the DOM and window location
   */
  browser?: EditorArchiveBrowser;
}

export class EditorArchives {
  #session: EditorArchiveSession;
  #accepts: string;
  #fallbackName: string;
  #resetWarning: string;
  #navigator: LaunchNavigator;
  #browser: EditorArchiveBrowser;
  #accepted = new Map<string, AcceptedDependency>();

  constructor(
    options: EditorArchivesOptions
  ) {
    this.#session = options.session;
    this.#accepts = options.accepts;
    this.#fallbackName = options.fallbackName ?? options.accepts;
    this.#resetWarning = options.resetWarning ?? kResetWarning;
    this.#navigator = options.navigator;
    this.#browser = options.browser ?? kDomArchiveBrowser;
  }

  get canImport(): boolean {
    return this.#session.archive.canImport;
  }

  get canReset(): boolean {
    const { offline } = this.#session;

    return offline?.persistent === true && offline.canReset !== false;
  }

  get dependencies(): AssetRecordData[] {
    const { catalog, targetRecord } = this.#session;

    return catalog.dependencies
      .listDependencies(targetRecord.id)
      .flatMap((reference) => catalog.record(reference.id) ?? []);
  }

  async download(): Promise<void> {
    const { id, path } = this.#session.targetRecord;

    await this.#save(id, path);
  }

  async downloadAsset(
    assetId: string
  ): Promise<void> {
    const record = this.#session.catalog.record(assetId);

    await this.#save(assetId, record?.path ?? assetId);
  }

  acceptDependency(
    format: EditorDependencyFormat,
    link: EditorDependencyLink
  ): () => void {
    const accepted = {
      format,
      link
    };
    this.#accepted.set(format.kind, accepted);

    return () => {
      if (this.#accepted.get(format.kind) === accepted) {
        this.#accepted.delete(format.kind);
      }
    };
  }

  async importFile(
    file: File,
    kind?: string
  ): Promise<void> {
    if (!this.canImport) {
      throw new ArchiveImportDisabledError();
    }

    const single = this.#acceptedIn(kind).find(
      ({ format }) => file.name.endsWith(format.extension)
    );
    if (single === undefined) {
      await this.#importArchive(file, kind);
    }
    else {
      await this.#createDependency(file, single);
    }
  }

  async pickAndImport(
    kind?: string
  ): Promise<void> {
    if (!this.canImport) {
      throw new ArchiveImportDisabledError();
    }

    const extensions = this.#acceptedIn(kind).map(
      ({ format }) => format.extension.slice(format.extension.lastIndexOf("."))
    );
    const file = await this.#browser.pickFile(
      [kArchiveAccept, ...extensions].join(",")
    );
    if (file !== null) {
      await this.importFile(file, kind);
    }
  }

  async reset(): Promise<void> {
    if (!await this.#browser.confirmReset(this.#resetWarning)) {
      return;
    }

    await this.#session.offline?.reset();
    this.#browser.location.reload();
  }

  #acceptedIn(
    kind: string | undefined
  ): AcceptedDependency[] {
    const accepted = [...this.#accepted.values()];

    return kind === undefined ?
      accepted :
      accepted.filter(({ format }) => format.kind === kind);
  }

  async #createDependency(
    file: File,
    { format, link }: AcceptedDependency
  ): Promise<void> {
    const id = await this.#session.catalog.create(
      `${format.folder}${file.name}`,
      new Uint8Array(await file.arrayBuffer()),
      {
        kind: format.kind,
        onConflict: "suffix"
      }
    );
    link({
      id,
      kind: format.kind
    });
  }

  async #importArchive(
    file: File,
    kind: string | undefined
  ): Promise<void> {
    const plan = await this.#session.archive.plan(file);
    const rootKind = plan.root?.kind;
    const dependency = rootKind === undefined ?
      undefined :
      this.#accepted.get(rootKind);
    if (
      (rootKind !== this.#accepts && dependency === undefined) ||
      (kind !== undefined && rootKind !== kind)
    ) {
      throw new ArchiveRootError(kind ?? this.#accepts);
    }

    const onConflict = plan.live.length === 0 ?
      "keep" :
      await this.#browser.askConflictPolicy(plan);
    if (onConflict === null) {
      return;
    }

    const { root, replaced } = await this.#session.archive.import(
      file,
      { onConflict }
    );
    if (root === undefined) {
      throw new ArchiveRootError(kind ?? this.#accepts);
    }

    if (dependency === undefined) {
      await this.#switchTo(root.id, replaced.length > 0);
    }
    else {
      this.#linkImported(dependency, root, replaced);
    }
  }

  async #switchTo(
    rootId: string,
    replaced: boolean
  ): Promise<void> {
    if (!replaced) {
      await this.#navigator.navigate(rootId, null);

      return;
    }

    const { location } = this.#browser;
    location.assign(
      new EditorLaunch(
        new AssetId(rootId)
      ).toUrl(location.href).toString()
    );
  }

  #linkImported(
    { link }: AcceptedDependency,
    root: AssetReferenceData,
    replaced: ImportReport["replaced"]
  ): void {
    const { catalog, targetRecord } = this.#session;
    const linked = catalog.dependencies
      .listDependencies(targetRecord.id)
      .some((reference) => reference.id === root.id);
    if (!linked) {
      link(root);
    }

    const open = new Set([
      targetRecord.id,
      ...catalog.dependencies
        .transitiveDependencies(targetRecord.id)
        .map((reference) => reference.id)
    ]);
    if (replaced.some((entry) => open.has(entry.id))) {
      this.#browser.location.reload();
    }
  }

  async #save(
    assetId: string,
    path: string
  ): Promise<void> {
    const blob = await this.#session.archive.export(assetId);

    this.#browser.save(blob, this.#fileName(path));
  }

  #fileName(
    path: string
  ): string {
    const { name } = new AssetPath(path);

    return `${name || this.#fallbackName}${kArchiveExtension}`;
  }
}
