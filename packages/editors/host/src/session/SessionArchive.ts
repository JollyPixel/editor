// Import Third-party Dependencies
import type {
  CatalogImportOptions,
  ImportPlan,
  ImportReport
} from "@jolly-pixel/asset-server/catalog/client";

export {
  ARCHIVE_MIME_TYPE,
  CatalogSessionArchive,
  type ArchiveCatalog,
  type CatalogSessionArchiveOptions
} from "@jolly-pixel/asset-server/catalog/client";

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
