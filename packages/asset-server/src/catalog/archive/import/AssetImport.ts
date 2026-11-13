// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import * as z from "zod/mini";
import type { DeepReadonly } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { assetArchiveEntrySchema } from "../AssetArchive.ts";
import { assetReferenceSchema } from "../../../model/events/AssetEvents.schema.ts";
import type { AssetArchiveError } from "../errors/AssetArchiveError.ts";
import type {
  UnknownAssetKindError
} from "../../../model/kinds/errors/UnknownAssetKindError.ts";

// CONSTANTS
export const IMPORT_CONFLICT_POLICIES = ["replace", "keep", "copy"] as const;

const kEntries = z.array(assetArchiveEntrySchema);

export const sharedDependentsSchema = z.extend(assetArchiveEntrySchema, {
  dependents: kEntries
});

export const importPlanSchema = z.object({
  root: z.optional(assetReferenceSchema),
  live: kEntries,
  fresh: kEntries,
  sharedDependents: z.array(sharedDependentsSchema),
  incompatible: kEntries
});

export const importFailureSchema = z.extend(assetArchiveEntrySchema, {
  reason: z.string()
});

export const importReportSchema = z.object({
  root: z.optional(assetReferenceSchema),
  created: kEntries,
  replaced: kEntries,
  kept: kEntries,
  failed: z.array(importFailureSchema)
});

export type ImportConflictPolicy = typeof IMPORT_CONFLICT_POLICIES[number];
export type SharedDependents = DeepReadonly<Infer<typeof sharedDependentsSchema>>;
export type ImportPlan = DeepReadonly<Infer<typeof importPlanSchema>>;
export type ImportFailure = DeepReadonly<Infer<typeof importFailureSchema>>;
export type ImportReport = DeepReadonly<Infer<typeof importReportSchema>>;

export type AssetImportError = AssetArchiveError | UnknownAssetKindError;
