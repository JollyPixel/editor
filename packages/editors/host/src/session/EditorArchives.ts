// Import Third-party Dependencies
import {
  AssetId,
  AssetPath
} from "@jolly-pixel/asset";
import type {
  ImportConflictPolicy,
  ImportPlan
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
  readonly path: string;
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

export interface EditorArchiveSession {
  readonly archive: SessionArchive;
  readonly offline: OfflineMode | null;
  readonly targetRecord: EditorArchiveTarget;
}

export interface EditorArchivesOptions extends EditorArchiveLabels {
  session: EditorArchiveSession;
  /**
   * Asset kind the editor opens; an archive rooted on another kind is refused.
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

  async download(): Promise<void> {
    const { id, path } = this.#session.targetRecord;
    const blob = await this.#session.archive.export(id);

    this.#browser.save(blob, this.#fileName(path));
  }

  async importFile(
    file: Blob
  ): Promise<void> {
    const plan = await this.#session.archive.plan(file);
    if (plan.root?.kind !== this.#accepts) {
      throw new ArchiveRootError(this.#accepts);
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
      throw new ArchiveRootError(this.#accepts);
    }
    if (replaced.length === 0) {
      await this.#navigator.navigate(root.id, null);

      return;
    }

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

    await this.#session.offline?.reset();
    this.#browser.location.reload();
  }

  #fileName(
    path: string
  ): string {
    const { name } = new AssetPath(path);

    return `${name || this.#fallbackName}${kArchiveExtension}`;
  }
}
