// Import Internal Dependencies
import type {
  ImportPlan,
  ImportReport
} from "../../archive/import/AssetImport.ts";
import type { CatalogImportOptions } from "./CatalogClient.ts";
import { ArchiveImportDisabledError } from "./errors/ArchiveImportDisabledError.ts";

// CONSTANTS
export const ARCHIVE_MIME_TYPE = "application/zip";

export interface ArchiveCatalog {
  exportArchive(
    root?: string
  ): Promise<Uint8Array>;

  planImport(
    archive: Uint8Array
  ): Promise<ImportPlan>;

  importArchive(
    archive: Uint8Array,
    options: CatalogImportOptions
  ): Promise<ImportReport>;
}

export interface CatalogSessionArchiveOptions {
  catalog: ArchiveCatalog;
  canImport: boolean;
}

export class CatalogSessionArchive {
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
    options: CatalogImportOptions
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
