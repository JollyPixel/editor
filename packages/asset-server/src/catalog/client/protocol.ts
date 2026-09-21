// Import Third-party Dependencies
import type {
  AssetManifestData,
  AssetRecordData,
  AssetReferenceData
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { AssetInlineContent } from "../../events/AssetEvents.schema.ts";
import type { DependencyMap } from "./DependencyIndex.ts";
import type { PathConflictPolicy } from "../../writer/AssetWriter.ts";
import type {
  ImportConflictPolicy,
  ImportPlan,
  ImportReport
} from "../../archive/AssetArchive.ts";

// CONSTANTS
export const CATALOG_ROOM = "asset-catalog";

export const CATALOG_SNAPSHOT = "catalog:snapshot";
export const CATALOG_CHANGED = "catalog:changed";
export const CATALOG_APPLIED = "catalog:applied";
export const CATALOG_REJECTED = "catalog:rejected";

export const CATALOG_CREATE = "catalog:create";
export const CATALOG_RENAME = "catalog:rename";
export const CATALOG_DELETE = "catalog:delete";
export const CATALOG_EXPORT = "catalog:export";
export const CATALOG_PLAN = "catalog:plan";
export const CATALOG_IMPORT = "catalog:import";

export type CatalogLifecycleCommandType =
  | typeof CATALOG_CREATE
  | typeof CATALOG_RENAME
  | typeof CATALOG_DELETE;

export type CatalogCommandType =
  | CatalogLifecycleCommandType
  | typeof CATALOG_EXPORT
  | typeof CATALOG_PLAN
  | typeof CATALOG_IMPORT;

export type CatalogPathConflict = PathConflictPolicy;

export type CatalogInlineContent = AssetInlineContent;

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

export interface CatalogExportCommand {
  type: typeof CATALOG_EXPORT;
  requestId?: string;
  root?: string;
}

export interface CatalogPlanCommand {
  type: typeof CATALOG_PLAN;
  requestId?: string;
  content: CatalogInlineContent;
}

export interface CatalogImportCommand {
  type: typeof CATALOG_IMPORT;
  requestId?: string;
  content: CatalogInlineContent;
  onConflict: ImportConflictPolicy;
}

export type CatalogCommand =
  | CatalogCreateCommand
  | CatalogRenameCommand
  | CatalogDeleteCommand
  | CatalogExportCommand
  | CatalogPlanCommand
  | CatalogImportCommand;

type CatalogLifecycleApplied<
  TCommand extends CatalogLifecycleCommandType = CatalogLifecycleCommandType
> = TCommand extends unknown ?
  { command: TCommand; assetId: string; } :
  never;

export type CatalogApplied =
  | CatalogLifecycleApplied
  | { command: typeof CATALOG_EXPORT; content: CatalogInlineContent; }
  | { command: typeof CATALOG_PLAN; plan: ImportPlan; }
  | { command: typeof CATALOG_IMPORT; report: ImportReport; };

export interface CatalogChange {
  readonly eventType: string;
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
  }
  | { type: typeof CATALOG_CHANGED; change: CatalogChange; }
  | (CatalogApplied & {
    type: typeof CATALOG_APPLIED;
    requestId?: string;
  })
  | {
    type: typeof CATALOG_REJECTED;
    requestId?: string;
    command: CatalogCommandType;
    reason: string;
  };
