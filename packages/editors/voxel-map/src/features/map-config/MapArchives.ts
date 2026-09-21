// Import Third-party Dependencies
import {
  LAUNCH_QUERY_PARAM,
  LastOpenedLaunchSource,
  type SessionArchive,
  type SessionWorkspace
} from "@jolly-pixel/editor.host";
import type {
  ImportConflictPolicy,
  ImportPlan,
  ImportReport
} from "@jolly-pixel/asset-server/catalog/client";

// CONSTANTS
const kArchiveExtension = ".zip";
const kFallbackArchiveName = "map";

export interface MapArchiveTarget {
  readonly id: string;
  readonly source: string;
}

export interface MapArchivesOptions {
  archive: SessionArchive;
  workspace: SessionWorkspace | null;
  accepts: string;
  target(): MapArchiveTarget;
}

export interface MapArchiveDownload {
  blob: Blob;
  fileName: string;
}

export class MapImportWithoutRootError extends Error {
  constructor() {
    super("The archive does not name a map to open.");
    this.name = "MapImportWithoutRootError";
  }
}

export class MapArchives {
  #archive: SessionArchive;
  #workspace: SessionWorkspace | null;
  #accepts: string;
  #target: () => MapArchiveTarget;

  constructor(
    options: MapArchivesOptions
  ) {
    this.#archive = options.archive;
    this.#workspace = options.workspace;
    this.#accepts = options.accepts;
    this.#target = options.target;
  }

  get canImport(): boolean {
    return this.#archive.canImport;
  }

  get canReset(): boolean {
    return this.#workspace?.persistent === true;
  }

  get volatile(): boolean {
    return this.#workspace?.persistent === false;
  }

  get fileName(): string {
    const { source } = this.#target();
    const base = source.slice(source.lastIndexOf("/") + 1);
    const extension = base.indexOf(".");
    const name = extension > 0 ? base.slice(0, extension) : base;

    return `${name || kFallbackArchiveName}${kArchiveExtension}`;
  }

  async export(): Promise<MapArchiveDownload> {
    return {
      blob: await this.#archive.export(this.#target().id),
      fileName: this.fileName
    };
  }

  plan(
    file: Blob
  ): Promise<ImportPlan> {
    return this.#archive.plan(file);
  }

  async import(
    file: Blob,
    onConflict: ImportConflictPolicy
  ): Promise<ImportReport> {
    const report = await this.#archive.import(file, { onConflict });
    if (report.root === undefined) {
      throw new MapImportWithoutRootError();
    }

    LastOpenedLaunchSource.remember(this.#accepts, report.root.id);

    return report;
  }

  launchUrl(
    href: string,
    assetId: string
  ): string {
    const url = new URL(href);
    url.searchParams.set(LAUNCH_QUERY_PARAM, assetId);

    return url.toString();
  }

  async reset(): Promise<void> {
    await this.#workspace?.reset();
  }
}
