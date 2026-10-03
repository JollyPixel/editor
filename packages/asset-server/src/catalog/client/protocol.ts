// Import Third-party Dependencies
import type {
  Infer,
  InferMessage
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  catalogChangeSchema,
  catalogCommandProtocol,
  catalogMessageProtocol
} from "../protocol.schema.ts";
import type { Immutable } from "../../utils/Immutable.ts";

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

type Without<TValue, TKey extends PropertyKey> = TValue extends unknown ?
  Omit<TValue, TKey> :
  never;

export type CatalogCommand = InferMessage<typeof catalogCommandProtocol>;
export type CatalogRequest = Without<CatalogCommand, "requestId">;
export type CatalogCommandType = CatalogCommand["type"];

type RequestOf<TType extends CatalogCommandType> = Extract<
  CatalogRequest,
  { type: TType; }
>;

export type CatalogCreateCommand = RequestOf<typeof CATALOG_CREATE>;
export type CatalogRenameCommand = RequestOf<typeof CATALOG_RENAME>;
export type CatalogDeleteCommand = RequestOf<typeof CATALOG_DELETE>;
export type CatalogCreateFolderCommand = RequestOf<typeof CATALOG_CREATE_FOLDER>;
export type CatalogMoveFolderCommand = RequestOf<typeof CATALOG_MOVE_FOLDER>;
export type CatalogDeleteFolderCommand = RequestOf<typeof CATALOG_DELETE_FOLDER>;
export type CatalogExportCommand = RequestOf<typeof CATALOG_EXPORT>;
export type CatalogPlanCommand = RequestOf<typeof CATALOG_PLAN>;
export type CatalogImportCommand = RequestOf<typeof CATALOG_IMPORT>;

export type CatalogMessage = Immutable<
  InferMessage<typeof catalogMessageProtocol>
>;
export type CatalogApplied = Without<
  Extract<CatalogMessage, { type: typeof CATALOG_APPLIED; }>,
  "type" | "requestId"
>;
export type CatalogChange = Immutable<Infer<typeof catalogChangeSchema>>;
