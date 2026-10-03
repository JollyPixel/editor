// Import Third-party Dependencies
import {
  defineSchema,
  type Infer
} from "@jolly-pixel/network";

// Import Internal Dependencies
import { assetArchiveEntrySchema } from "../AssetArchive.ts";
import { assetReferenceSchema } from "../../events/AssetEvents.schema.ts";
import type { AssetArchiveError } from "../errors/AssetArchiveError.ts";
import type {
  UnknownAssetKindError
} from "../../kinds/errors/UnknownAssetKindError.ts";
import type { Immutable } from "../../utils/Immutable.ts";

// CONSTANTS
export const IMPORT_CONFLICT_POLICIES = ["replace", "keep", "copy"] as const;

const kEntries = {
  type: "array",
  items: assetArchiveEntrySchema
} as const;

export const sharedDependentsSchema = defineSchema({
  type: "object",
  properties: {
    ...assetArchiveEntrySchema.properties,
    dependents: kEntries
  },
  required: [
    ...assetArchiveEntrySchema.required,
    "dependents"
  ]
});

export const importPlanSchema = defineSchema({
  type: "object",
  properties: {
    root: assetReferenceSchema,
    live: kEntries,
    fresh: kEntries,
    sharedDependents: {
      type: "array",
      items: sharedDependentsSchema
    },
    incompatible: kEntries
  },
  required: [
    "live",
    "fresh",
    "sharedDependents",
    "incompatible"
  ]
});

export const importFailureSchema = defineSchema({
  type: "object",
  properties: {
    ...assetArchiveEntrySchema.properties,
    reason: { type: "string" }
  },
  required: [
    ...assetArchiveEntrySchema.required,
    "reason"
  ]
});

export const importReportSchema = defineSchema({
  type: "object",
  properties: {
    root: assetReferenceSchema,
    created: kEntries,
    replaced: kEntries,
    kept: kEntries,
    failed: {
      type: "array",
      items: importFailureSchema
    }
  },
  required: [
    "created",
    "replaced",
    "kept",
    "failed"
  ]
});

export type ImportConflictPolicy = typeof IMPORT_CONFLICT_POLICIES[number];
export type SharedDependents = Immutable<Infer<typeof sharedDependentsSchema>>;
export type ImportPlan = Immutable<Infer<typeof importPlanSchema>>;
export type ImportFailure = Immutable<Infer<typeof importFailureSchema>>;
export type ImportReport = Immutable<Infer<typeof importReportSchema>>;

export type AssetImportError = AssetArchiveError | UnknownAssetKindError;
