// Import Third-party Dependencies
import {
  ARCHIVE_MIME_TYPE,
  type CatalogClient,
  type CatalogImportOptions,
  type ImportPlan,
  type ImportReport
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { ArchiveImportDisabledError } from "./errors/ArchiveImportDisabledError.ts";

export type SessionArchiveImportOptions = CatalogImportOptions;

export interface SessionArchive {
  readonly canImport: boolean;

  export(
    assetId?: string
  ): Promise<Blob>;

  plan(
    file: Blob
  ): Promise<ImportPlan>;

  import(
    file: Blob,
    options: SessionArchiveImportOptions
  ): Promise<ImportReport>;
}

export type ArchiveCatalog = Pick<
  CatalogClient,
  | "exportArchive"
  | "planImport"
  | "importArchive"
>;

export interface CatalogSessionArchiveOptions {
  catalog: ArchiveCatalog;
  canImport: boolean;
}

export class CatalogSessionArchive implements SessionArchive {
  readonly canImport: boolean;

  #catalog: ArchiveCatalog;

  constructor(
    options: CatalogSessionArchiveOptions
  ) {
    this.canImport = options.canImport;
    this.#catalog = options.catalog;
  }

  async export(
    assetId?: string
  ): Promise<Blob> {
    const bytes = await this.#catalog.exportArchive(assetId);

    return new Blob([Uint8Array.from(bytes)], {
      type: ARCHIVE_MIME_TYPE
    });
  }

  async plan(
    file: Blob
  ): Promise<ImportPlan> {
    return this.#catalog.planImport(
      new Uint8Array(await file.arrayBuffer())
    );
  }

  async import(
    file: Blob,
    options: SessionArchiveImportOptions
  ): Promise<ImportReport> {
    if (!this.canImport) {
      throw new ArchiveImportDisabledError();
    }

    return this.#catalog.importArchive(
      new Uint8Array(await file.arrayBuffer()),
      options
    );
  }
}
