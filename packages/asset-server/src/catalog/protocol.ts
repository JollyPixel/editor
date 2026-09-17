// Import Third-party Dependencies
import type {
  AssetManifestData,
  AssetRecordData
} from "@jolly-pixel/asset";

// CONSTANTS
export const CATALOG_ROOM = "asset-catalog";

export const CATALOG_SNAPSHOT = "catalog:snapshot";
export const CATALOG_CHANGED = "catalog:changed";
export const CATALOG_APPLIED = "catalog:applied";
export const CATALOG_REJECTED = "catalog:rejected";

export const CATALOG_CREATE = "catalog:create";
export const CATALOG_RENAME = "catalog:rename";
export const CATALOG_DELETE = "catalog:delete";

export type CatalogCommandType =
  | typeof CATALOG_CREATE
  | typeof CATALOG_RENAME
  | typeof CATALOG_DELETE;

export type CatalogPathConflict = "reject" | "suffix";

export interface CatalogInlineContent {
  type: "inline";
  encoding: "base64";
  data: string;
}

export interface CatalogCreateCommand {
  type: typeof CATALOG_CREATE;
  requestId?: string;
  path: string;
  kind?: string;
  onConflict?: CatalogPathConflict;
  content: CatalogInlineContent;
}

export interface CatalogRenameCommand {
  type: typeof CATALOG_RENAME;
  requestId?: string;
  assetId: string;
  to: string;
}

export interface CatalogDeleteCommand {
  type: typeof CATALOG_DELETE;
  requestId?: string;
  assetId: string;
}

export type CatalogCommand =
  | CatalogCreateCommand
  | CatalogRenameCommand
  | CatalogDeleteCommand;

export interface CatalogChange {
  readonly eventType: string;
  readonly assetId: string;
  readonly record: AssetRecordData | null;
}

export type CatalogMessage =
  | { type: typeof CATALOG_SNAPSHOT; manifest: AssetManifestData; }
  | { type: typeof CATALOG_CHANGED; change: CatalogChange; }
  | {
    type: typeof CATALOG_APPLIED;
    requestId?: string;
    command: CatalogCommandType;
    assetId: string;
  }
  | {
    type: typeof CATALOG_REJECTED;
    requestId?: string;
    command: CatalogCommandType;
    reason: string;
  };
