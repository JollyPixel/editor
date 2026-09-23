// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { AssetArchiveEntry } from "../AssetArchive.ts";
import type { AssetArchiveError } from "../errors/AssetArchiveError.ts";
import type {
  UnknownAssetKindError
} from "../../kinds/errors/UnknownAssetKindError.ts";

export type ImportConflictPolicy = "replace" | "keep" | "copy";

export interface SharedDependents extends AssetArchiveEntry {
  readonly dependents: readonly AssetArchiveEntry[];
}

export interface ImportPlan {
  readonly root?: AssetReferenceData;
  readonly live: readonly AssetArchiveEntry[];
  readonly fresh: readonly AssetArchiveEntry[];
  readonly sharedDependents: readonly SharedDependents[];
  readonly incompatible: readonly AssetArchiveEntry[];
}

export interface ImportFailure extends AssetArchiveEntry {
  readonly reason: string;
}

export interface ImportReport {
  readonly root?: AssetReferenceData;
  readonly created: readonly AssetArchiveEntry[];
  readonly replaced: readonly AssetArchiveEntry[];
  readonly kept: readonly AssetArchiveEntry[];
  readonly failed: readonly ImportFailure[];
}

export type AssetImportError = AssetArchiveError | UnknownAssetKindError;
