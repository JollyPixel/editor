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
import type { Immutable, Without } from "../../common/types.ts";
import { MAX_KIND_CONTENT_BYTES } from "../../model/kinds/KindLimits.ts";

// CONSTANTS
const kEnvelopeBytes = 1024 * 1024;
export const MAX_CATALOG_MESSAGE_BYTES =
  Math.ceil(MAX_KIND_CONTENT_BYTES / 3) * 4 + kEnvelopeBytes;
export const CATALOG_ROOM = "asset-catalog";
export const CATALOG_VIEW_ROOM = "asset-catalog-view";
export const ARCHIVE_MIME_TYPE = "application/zip";

export const CATALOG_SNAPSHOT = "catalog:snapshot";
export const CATALOG_CHANGED = "catalog:changed";
export const CATALOG_FOLDERS = "catalog:folders";
export const CATALOG_APPLIED = "catalog:applied";
export const CATALOG_REJECTED = "catalog:rejected";
export const CATALOG_TAGS_CHANGED = "catalog:tags-changed";
export const CATALOG_PROGRESS = "catalog:progress";

export const CATALOG_CREATE = "catalog:create";
export const CATALOG_RENAME = "catalog:rename";
export const CATALOG_DELETE = "catalog:delete";
export const CATALOG_CREATE_FOLDER = "catalog:create-folder";
export const CATALOG_MOVE_FOLDER = "catalog:move-folder";
export const CATALOG_DELETE_FOLDER = "catalog:delete-folder";
export const CATALOG_EXPORT = "catalog:export";
export const CATALOG_PLAN = "catalog:plan";
export const CATALOG_IMPORT = "catalog:import";
export const CATALOG_TAGS = "catalog:tags";
export const CATALOG_TAG = "catalog:tag";
export const CATALOG_UNTAG = "catalog:untag";
export const CATALOG_RESTORE = "catalog:restore";
export const CATALOG_REPLACE = "catalog:replace";
export const CATALOG_READ = "catalog:read";
export const CATALOG_PREVIEW = "catalog:preview";

export const CATALOG_STAGES = ["converting", "writing"] as const;

export type CatalogCommand = InferMessage<typeof catalogCommandProtocol>;
export type CatalogRequest = Without<CatalogCommand, "requestId">;
export type CatalogCommandType = CatalogCommand["type"];
export type CatalogStage = typeof CATALOG_STAGES[number];
export type CatalogProgress = (stage: CatalogStage) => void;

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
export type CatalogTagCommand = RequestOf<typeof CATALOG_TAG>;
export type CatalogRestoreCommand = RequestOf<typeof CATALOG_RESTORE>;
export type CatalogReplaceCommand = RequestOf<typeof CATALOG_REPLACE>;
export type CatalogReadCommand = RequestOf<typeof CATALOG_READ>;
export type CatalogPreviewCommand = RequestOf<typeof CATALOG_PREVIEW>;

export type CatalogMessage = Immutable<
  InferMessage<typeof catalogMessageProtocol>
>;
export type CatalogApplied = Without<
  Extract<CatalogMessage, { type: typeof CATALOG_APPLIED; }>,
  "type" | "requestId"
>;
export type CatalogChange = Immutable<Infer<typeof catalogChangeSchema>>;
