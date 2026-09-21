// Import Third-party Dependencies
import { defineSchema } from "@jolly-pixel/network";
import type { Infer } from "ata-validator";

export const assetInlineContentSchema = defineSchema({
  type: "object",
  properties: {
    type: { const: "inline" },
    encoding: { const: "base64" },
    data: { type: "string" }
  },
  required: [
    "type",
    "encoding",
    "data"
  ]
});

export type AssetInlineContent = Infer<typeof assetInlineContentSchema>;

export const assetContentSchema = defineSchema({
  oneOf: [
    assetInlineContentSchema,
    {
      type: "object",
      properties: {
        type: { const: "ref" },
        hash: { type: "string" },
        size: { type: "number" }
      },
      required: [
        "type",
        "hash",
        "size"
      ]
    }
  ]
});

export const assetReferenceSchema = defineSchema({
  type: "object",
  properties: {
    id: { type: "string" },
    kind: { type: "string" }
  },
  required: [
    "id",
    "kind"
  ]
});

export const assetWriteDataSchema = defineSchema({
  type: "object",
  properties: {
    path: { type: "string" },
    kind: { type: "string" },
    hash: { type: "string" },
    size: { type: "number" },
    content: assetContentSchema,
    dependencies: {
      type: "array",
      items: assetReferenceSchema
    }
  },
  required: [
    "path",
    "kind",
    "hash",
    "size",
    "content"
  ]
});

export const assetRenamedDataSchema = defineSchema({
  type: "object",
  properties: {
    from: { type: "string" },
    to: { type: "string" },
    kind: { type: "string" },
    hash: { type: "string" }
  },
  required: [
    "from",
    "to",
    "kind",
    "hash"
  ]
});

export const assetDeletedDataSchema = defineSchema({
  type: "object",
  properties: {
    path: { type: "string" },
    kind: { type: "string" }
  },
  required: [
    "path",
    "kind"
  ]
});
