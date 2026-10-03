// Import Third-party Dependencies
import type {
  AssetManifestData,
  AssetRecordData,
  AssetReferenceData
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { AssetInlineContent } from "../../events/AssetEvents.schema.ts";
import type { AssetEventType } from "../../events/AssetEvents.ts";
import type { DependencyMap } from "./DependencyIndex.ts";
import type { PathConflictPolicy } from "../../writer/AssetWriter.ts";
import type {
  ImportConflictPolicy,
  ImportPlan,
  ImportReport
} from "../../archive/import/AssetImport.ts";

// CONSTANTS
export const CATALOG_ROOM = "asset-catalog";
export const ARCHIVE_MIME_TYPE = "application/zip";

export const CATALOG_SNAPSHOT = "catalog:snapshot";
export const CATALOG_CHANGED = "catalog:changed";
export const CATALOG_FOLDERS = "catalog:folders";
export const CATALOG_APPLIED = "catalog:applied";
export const CATALOG_REJECTED = "catalog:rejected";

export const CATALOG_CREATE = "catalog:create";
export const CATALOG_RENAME = "catalog:rename";
export const CATALOG_DELETE = "catalog:delete";
export const CATALOG_CREATE_FOLDER = "catalog:create-folder";
export const CATALOG_MOVE_FOLDER = "catalog:move-folder";
export const CATALOG_DELETE_FOLDER = "catalog:delete-folder";
export const CATALOG_EXPORT = "catalog:export";
export const CATALOG_PLAN = "catalog:plan";
export const CATALOG_IMPORT = "catalog:import";

export interface CatalogCreateCommand {
  type: typeof CATALOG_CREATE;
  path: string;
  kind?: string;
  onConflict?: PathConflictPolicy;
  content?: AssetInlineContent;
}

export interface CatalogRenameCommand {
  type: typeof CATALOG_RENAME;
  assetId: string;
  to: string;
}

export interface CatalogDeleteCommand {
  type: typeof CATALOG_DELETE;
  assetId: string;
  force?: boolean;
}

export interface CatalogCreateFolderCommand {
  type: typeof CATALOG_CREATE_FOLDER;
  path: string;
}

export interface CatalogMoveFolderCommand {
  type: typeof CATALOG_MOVE_FOLDER;
  from: string;
  to: string;
}

export interface CatalogDeleteFolderCommand {
  type: typeof CATALOG_DELETE_FOLDER;
  path: string;
}

export interface CatalogExportCommand {
  type: typeof CATALOG_EXPORT;
  root?: string;
}

export interface CatalogPlanCommand {
  type: typeof CATALOG_PLAN;
  content: AssetInlineContent;
}

export interface CatalogImportCommand {
  type: typeof CATALOG_IMPORT;
  content: AssetInlineContent;
  onConflict: ImportConflictPolicy;
}

export type CatalogRequest =
  | CatalogCreateCommand
  | CatalogRenameCommand
  | CatalogDeleteCommand
  | CatalogCreateFolderCommand
  | CatalogMoveFolderCommand
  | CatalogDeleteFolderCommand
  | CatalogExportCommand
  | CatalogPlanCommand
  | CatalogImportCommand;

export type CatalogCommand = CatalogRequest & { requestId: string; };

export type CatalogCommandType = CatalogRequest["type"];

export type CatalogApplied =
  | { command: typeof CATALOG_CREATE; assetId: string; }
  | { command: typeof CATALOG_RENAME; assetId: string; }
  | { command: typeof CATALOG_DELETE; assetId: string; }
  | { command: typeof CATALOG_CREATE_FOLDER; path: string; }
  | { command: typeof CATALOG_MOVE_FOLDER; path: string; }
  | { command: typeof CATALOG_DELETE_FOLDER; path: string; }
  | { command: typeof CATALOG_EXPORT; content: AssetInlineContent; }
  | { command: typeof CATALOG_PLAN; plan: ImportPlan; }
  | { command: typeof CATALOG_IMPORT; report: ImportReport; };

export interface CatalogChange {
  readonly eventType: AssetEventType;
  readonly assetId: string;
  readonly record: AssetRecordData | null;
  /**
   * Every outgoing edge of the asset after the change. Absent on deletion
   * and for assets written before edges were recorded.
   */
  readonly dependencies?: readonly AssetReferenceData[];
}

export type CatalogMessage =
  | {
    type: typeof CATALOG_SNAPSHOT;
    manifest: AssetManifestData;
    dependencies?: DependencyMap;
    folders: string[];
  }
  | { type: typeof CATALOG_CHANGED; change: CatalogChange; }
  | { type: typeof CATALOG_FOLDERS; folders: string[]; }
  | (CatalogApplied & {
    type: typeof CATALOG_APPLIED;
    requestId: string;
  })
  | {
    type: typeof CATALOG_REJECTED;
    requestId: string;
    command: CatalogCommandType;
    reason: string;
  };
