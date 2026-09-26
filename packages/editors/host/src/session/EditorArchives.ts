// Import Third-party Dependencies
import { showConfirm } from "@jolly-pixel/ui";
import type {
  ImportConflictPolicy,
  ImportPlan
} from "@jolly-pixel/asset-server/catalog/client";

// Import Internal Dependencies
import { LAUNCH_QUERY_PARAM } from "../launch/sources/QueryLaunchSource.ts";
import { LastOpenedLaunchSource } from "../launch/sources/LastOpenedLaunchSource.ts";
import type { SessionArchive } from "./SessionArchive.ts";
import type { SessionWorkspace } from "../workspace/SessionWorkspace.ts";
import { ArchiveRootError } from "./errors/ArchiveRootError.ts";
import { askImportConflictPolicy } from "./askImportConflictPolicy.ts";

// CONSTANTS
const kArchiveExtension = ".zip";
const kDomArchiveBrowser: EditorArchiveBrowser = {
  get location() {
    return globalThis.location;
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
      title: "Reset workspace",
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

/**
 * The browser side of the archive flows: downloads, dialogs and navigation.
 */
export interface EditorArchiveBrowser {
  readonly location: Pick<Location, "href" | "assign" | "reload">;
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
  workspace: SessionWorkspace | null;
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
  #workspace: SessionWorkspace | null;
  #accepts: string;
  #fallbackName: string;
  #resetWarning: string;
  #target: () => EditorArchiveTarget;
  #browser: EditorArchiveBrowser;

  constructor(
    options: EditorArchivesOptions
  ) {
    this.#archive = options.archive;
    this.#workspace = options.workspace;
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
    return this.#workspace?.persistent === true &&
      this.#workspace.canReset !== false;
  }

  get volatile(): boolean {
    return this.#workspace?.persistent === false;
  }

  /**
   * Exports the target and hands the archive to the browser as a download
   * named after the target path's stem.
   */
  async download(): Promise<void> {
    const { id, source } = this.#target();
    const blob = await this.#archive.export(id);

    this.#browser.save(blob, this.#fileName(source));
  }

  /**
   * Imports an archive rooted on an `accepts` asset, asking how to handle
   * assets that already exist, then reloads the editor onto the imported
   * root. Does nothing when the question is dismissed.
   */
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
    const url = new URL(location.href);
    url.searchParams.set(LAUNCH_QUERY_PARAM, root.id);
    location.assign(url.toString());
  }

  /**
   * Resets the workspace and reloads once the user confirms `resetWarning`.
   */
  async reset(): Promise<void> {
    if (!await this.#browser.confirmReset(this.#resetWarning)) {
      return;
    }

    await this.#workspace?.reset();
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
