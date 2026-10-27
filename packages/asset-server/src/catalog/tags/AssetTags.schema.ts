// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import { assetReferenceSchema } from "../../model/events/AssetEvents.schema.ts";
import type { Immutable } from "../../common/types.ts";
import {
  TAG_NAME_MAX_LENGTH,
  TAG_NAME_PATTERN
} from "./TagName.ts";

// CONSTANTS
export const TAG_MESSAGE_MAX_LENGTH = 4_096;

export const tagNameSchema = z.string().check(
  z.maxLength(TAG_NAME_MAX_LENGTH),
  z.regex(new RegExp(TAG_NAME_PATTERN))
);

export const tagReferenceSchema = z.string().check(
  z.minLength(1),
  z.maxLength(TAG_NAME_MAX_LENGTH)
);

export const tagMessageSchema = z.string().check(
  z.maxLength(TAG_MESSAGE_MAX_LENGTH)
);

export const actorSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("user"),
    id: z.string()
  }),
  z.object({
    type: z.literal("system"),
    source: z.string()
  })
]);

export const assetTagSchema = z.object({
  assetId: z.string(),
  name: z.string(),
  message: z.optional(z.string()),
  actor: actorSchema,
  createdAt: z.string(),
  eventVersion: z.int().check(z.minimum(1)),
  path: z.string(),
  hash: z.string(),
  size: z.int().check(z.minimum(0))
});

export const restoreReportSchema = z.object({
  restored: z.boolean(),
  restorePoint: z.optional(assetTagSchema),
  missing: z.array(assetReferenceSchema)
});

export const replaceReportSchema = z.object({
  replaced: z.boolean(),
  restorePoint: z.optional(assetTagSchema)
});

export type AssetTag = Immutable<Infer<typeof assetTagSchema>>;
export type ReplaceReport = Immutable<Infer<typeof replaceReportSchema>>;
export type RestoreReport = Immutable<Infer<typeof restoreReportSchema>>;
