// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";
import { showConfirm } from "@jolly-pixel/ui";
import type {
  ImportConflictPolicy,
  ImportPlan
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { EditorLaunch } from "../launch/EditorLaunch.ts";
import { LastOpenedLaunchSource } from "../launch/sources/LastOpenedLaunchSource.ts";
import type { SessionArchive } from "./SessionArchive.ts";
import type { OfflineMode } from "./OfflineMode.ts";
import { ArchiveRootError } from "./errors/ArchiveRootError.ts";
import { ArchiveImportDisabledError } from "./errors/ArchiveImportDisabledError.ts";
import { askImportConflictPolicy } from "./dialogs/askImportConflictPolicy.ts";

// CONSTANTS
const kArchiveExtension = ".zip";
const kArchiveAccept = ".zip,application/zip";
const kDomArchiveBrowser: EditorArchiveBrowser = {
  get location() {
    return globalThis.location;
  },
  pickArchive() {
    const { promise, resolve } = Promise.withResolvers<Blob | null>();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kArchiveAccept;
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
  readonly source: string;
}

export interface EditorArchiveBrowser {
  readonly location: Pick<Location, "href" | "assign" | "reload">;
  pickArchive(): Promise<Blob | null>;
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

export interface EditorArchivesOptions {
  archive: SessionArchive;
  offline: OfflineMode | null;
  /**
   * Asset kind the editor opens; an archive rooted on another kind is refused.
   */
  accepts: string;
  /**
   * Download name, without extension, when the target path has no stem.
   */
  fallbackName: string;
  /**
   * What a reset deletes, shown before the user confirms it.
   */
  resetWarning: string;
  target(): EditorArchiveTarget;
  /**
   * @default the DOM and window location
   */
  browser?: EditorArchiveBrowser;
}

export class EditorArchives {
  #archive: SessionArchive;
  #offline: OfflineMode | null;
  #accepts: string;
  #fallbackName: string;
  #resetWarning: string;
  #target: () => EditorArchiveTarget;
  #browser: EditorArchiveBrowser;

  constructor(
    options: EditorArchivesOptions
  ) {
    this.#archive = options.archive;
    this.#offline = options.offline;
    this.#accepts = options.accepts;
    this.#fallbackName = options.fallbackName;
    this.#resetWarning = options.resetWarning;
    this.#target = options.target;
    this.#browser = options.browser ?? kDomArchiveBrowser;
  }

  get canImport(): boolean {
    return this.#archive.canImport;
  }

  get canReset(): boolean {
    return this.#offline?.persistent === true &&
      this.#offline.canReset !== false;
  }

  get volatile(): boolean {
    return this.#offline?.persistent === false;
  }

  async download(): Promise<void> {
    const { id, source } = this.#target();
    const blob = await this.#archive.export(id);

    this.#browser.save(blob, this.#fileName(source));
  }

  async importFile(
    file: Blob
  ): Promise<void> {
    const plan = await this.#archive.plan(file);
    if (plan.root?.kind !== this.#accepts) {
      throw new ArchiveRootError(this.#accepts);
    }

    const onConflict = plan.live.length === 0 ?
      "keep" :
      await this.#browser.askConflictPolicy(plan);
    if (onConflict === null) {
      return;
    }

    const { root } = await this.#archive.import(file, { onConflict });
    if (root === undefined) {
      throw new ArchiveRootError(this.#accepts);
    }

    LastOpenedLaunchSource.remember(this.#accepts, root.id);

    const { location } = this.#browser;
    location.assign(
      new EditorLaunch(
        new AssetId(root.id)
      ).toUrl(location.href).toString()
    );
  }

  async pickAndImport(): Promise<void> {
    if (!this.canImport) {
      throw new ArchiveImportDisabledError();
    }

    const file = await this.#browser.pickArchive();
    if (file !== null) {
      await this.importFile(file);
    }
  }

  async reset(): Promise<void> {
    if (!await this.#browser.confirmReset(this.#resetWarning)) {
      return;
    }

    await this.#offline?.reset();
    this.#browser.location.reload();
  }

  #fileName(
    source: string
  ): string {
    const base = source.slice(source.lastIndexOf("/") + 1);
    const extension = base.indexOf(".");
    const name = extension > 0 ? base.slice(0, extension) : base;

    return `${name || this.#fallbackName}${kArchiveExtension}`;
  }
}
