// Import Third-party Dependencies
import {
  defineSchema,
  type Infer
} from "@jolly-pixel/network";

// Import Internal Dependencies
import { assetReferenceSchema } from "../events/AssetEvents.schema.ts";
import type { Immutable } from "../utils/Immutable.ts";
import {
  TAG_NAME_MAX_LENGTH,
  TAG_NAME_PATTERN
} from "./TagName.ts";

// CONSTANTS
export const TAG_MESSAGE_MAX_LENGTH = 4_096;

const kString = { type: "string" } as const;

export const tagNameSchema = defineSchema({
  type: "string",
  maxLength: TAG_NAME_MAX_LENGTH,
  pattern: TAG_NAME_PATTERN
});

export const tagReferenceSchema = defineSchema({
  type: "string",
  minLength: 1,
  maxLength: TAG_NAME_MAX_LENGTH
});

export const tagMessageSchema = defineSchema({
  type: "string",
  maxLength: TAG_MESSAGE_MAX_LENGTH
});

export const actorSchema = defineSchema({
  oneOf: [
    {
      type: "object",
      properties: {
        type: { const: "user" },
        id: kString
      },
      required: [
        "type",
        "id"
      ]
    },
    {
      type: "object",
      properties: {
        type: { const: "system" },
        source: kString
      },
      required: [
        "type",
        "source"
      ]
    }
  ]
});

export const assetTagSchema = defineSchema({
  type: "object",
  properties: {
    assetId: kString,
    name: kString,
    message: kString,
    actor: actorSchema,
    createdAt: kString,
    eventVersion: {
      type: "integer",
      minimum: 1
    },
    path: kString,
    hash: kString,
    size: {
      type: "integer",
      minimum: 0
    }
  },
  required: [
    "assetId",
    "name",
    "actor",
    "createdAt",
    "eventVersion",
    "path",
    "hash",
    "size"
  ]
});

export const restoreReportSchema = defineSchema({
  type: "object",
  properties: {
    restored: { type: "boolean" },
    restorePoint: assetTagSchema,
    missing: {
      type: "array",
      items: assetReferenceSchema
    }
  },
  required: [
    "restored",
    "missing"
  ]
});

export type AssetTag = Immutable<Infer<typeof assetTagSchema>>;
export type RestoreReport = Immutable<Infer<typeof restoreReportSchema>>;
