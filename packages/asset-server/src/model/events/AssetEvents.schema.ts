// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import * as z from "zod/mini";

export const assetInlineContentSchema = z.object({
  type: z.literal("inline"),
  encoding: z.literal("base64"),
  data: z.string()
});

export type AssetInlineContent = Infer<typeof assetInlineContentSchema>;

export const assetContentSchema = z.discriminatedUnion("type", [
  assetInlineContentSchema,
  z.object({
    type: z.literal("ref"),
    hash: z.string(),
    size: z.number()
  })
]);

export const assetReferenceSchema = z.object({
  id: z.string(),
  kind: z.string()
});

export const assetWriteDataSchema = z.object({
  path: z.string(),
  kind: z.string(),
  hash: z.string(),
  size: z.number(),
  content: assetContentSchema,
  dependencies: z.optional(z.array(assetReferenceSchema)),
  restoredFrom: z.optional(z.object({
    name: z.string(),
    eventVersion: z.int().check(z.minimum(1))
  }))
});

export const assetRenamedDataSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: z.string(),
  hash: z.string()
});

export const assetDeletedDataSchema = z.object({
  path: z.string(),
  kind: z.string()
});
