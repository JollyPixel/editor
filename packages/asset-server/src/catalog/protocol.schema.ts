// Import Third-party Dependencies
import {
  dependentRequired,
  MessageProtocol,
  type MessageProtocols
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_CREATE_FOLDER,
  CATALOG_DELETE,
  CATALOG_DELETE_FOLDER,
  CATALOG_EXPORT,
  CATALOG_FOLDERS,
  CATALOG_IMPORT,
  CATALOG_MOVE_FOLDER,
  CATALOG_PLAN,
  CATALOG_REJECTED,
  CATALOG_RENAME,
  CATALOG_REPLACE,
  CATALOG_RESTORE,
  CATALOG_SNAPSHOT,
  CATALOG_TAG,
  CATALOG_TAGS,
  CATALOG_TAGS_CHANGED,
  CATALOG_UNTAG
} from "./client/protocol.ts";
import {
  assetInlineContentSchema,
  assetReferenceSchema
} from "../model/events/AssetEvents.schema.ts";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED
} from "../model/events/AssetEvents.ts";
import { PATH_CONFLICT_POLICIES } from "../model/PathConflictPolicy.ts";
import {
  IMPORT_CONFLICT_POLICIES,
  importPlanSchema,
  importReportSchema
} from "./archive/import/AssetImport.ts";
import {
  assetTagSchema,
  replaceReportSchema,
  restoreReportSchema,
  tagMessageSchema,
  tagNameSchema,
  tagReferenceSchema
} from "./tags/AssetTags.schema.ts";

// CONSTANTS
const kString = z.string();
const kStrings = z.array(kString);
const kReferences = z.array(assetReferenceSchema);
const kTags = z.array(assetTagSchema);
const kRenameSchema = z.object({
  assetId: kString,
  to: kString
});
const kCommandTypes = [
  CATALOG_CREATE,
  CATALOG_RENAME,
  CATALOG_DELETE,
  CATALOG_CREATE_FOLDER,
  CATALOG_MOVE_FOLDER,
  CATALOG_DELETE_FOLDER,
  CATALOG_EXPORT,
  CATALOG_PLAN,
  CATALOG_IMPORT,
  CATALOG_TAGS,
  CATALOG_TAG,
  CATALOG_UNTAG,
  CATALOG_RESTORE,
  CATALOG_REPLACE
] as const;

export const assetRecordSchema = z.object({
  id: kString,
  kind: kString,
  path: kString,
  revision: z.optional(kString)
});

export const catalogChangeSchema = z.object({
  eventType: z.enum([
    ASSET_CREATED,
    ASSET_UPDATED,
    ASSET_RENAMED,
    ASSET_DELETED
  ]),
  assetId: kString,
  record: z.nullable(assetRecordSchema),
  dependencies: z.optional(kReferences)
});

export const dependencyMapSchema = z.record(z.string(), kReferences);

function requestVariant<
  const TType extends string,
  const TShape extends z.core.$ZodLooseShape
>(
  type: TType,
  shape: TShape
) {
  return z.object({
    type: z.literal(type),
    requestId: kString,
    ...shape
  });
}

function appliedVariant<
  const TCommand extends z.ZodMiniType,
  const TShape extends z.core.$ZodLooseShape
>(
  command: TCommand,
  shape: TShape
) {
  return requestVariant(CATALOG_APPLIED, {
    command,
    ...shape
  });
}

export const catalogCommandProtocol = new MessageProtocol(
  z.union([
    dependentRequired(
      requestVariant(CATALOG_CREATE, {
        path: kString,
        kind: z.optional(kString),
        onConflict: z.optional(z.enum(PATH_CONFLICT_POLICIES)),
        content: z.optional(assetInlineContentSchema),
        from: z.optional(kString)
      }),
      { from: ["content"] }
    ),
    requestVariant(CATALOG_RENAME, {
      renames: z.array(kRenameSchema).check(z.minLength(1))
    }),
    requestVariant(CATALOG_DELETE, {
      assetIds: z.array(kString).check(z.minLength(1)),
      force: z.optional(z.boolean())
    }),
    requestVariant(CATALOG_CREATE_FOLDER, {
      path: kString
    }),
    requestVariant(CATALOG_MOVE_FOLDER, {
      from: kString,
      to: kString
    }),
    requestVariant(CATALOG_DELETE_FOLDER, {
      path: kString
    }),
    requestVariant(CATALOG_EXPORT, {
      root: z.optional(kString)
    }),
    requestVariant(CATALOG_PLAN, {
      content: assetInlineContentSchema
    }),
    requestVariant(CATALOG_IMPORT, {
      content: assetInlineContentSchema,
      onConflict: z.enum(IMPORT_CONFLICT_POLICIES)
    }),
    requestVariant(CATALOG_TAGS, {
      assetId: kString
    }),
    requestVariant(CATALOG_TAG, {
      assetId: kString,
      name: tagNameSchema,
      message: z.optional(tagMessageSchema)
    }),
    requestVariant(CATALOG_UNTAG, {
      assetId: kString,
      name: tagReferenceSchema
    }),
    requestVariant(CATALOG_RESTORE, {
      assetId: kString,
      name: tagReferenceSchema
    }),
    requestVariant(CATALOG_REPLACE, {
      assetId: kString,
      content: assetInlineContentSchema,
      from: z.optional(kString)
    })
  ]),
  {
    discriminator: "type"
  }
);

export const catalogMessageProtocol = new MessageProtocol(
  z.union([
    z.object({
      type: z.literal(CATALOG_SNAPSHOT),
      manifest: z.object({
        version: z.literal(1),
        assets: z.array(assetRecordSchema)
      }),
      dependencies: z.optional(dependencyMapSchema),
      folders: kStrings
    }),
    z.object({
      type: z.literal(CATALOG_CHANGED),
      changes: z.array(catalogChangeSchema).check(z.minLength(1))
    }),
    z.object({
      type: z.literal(CATALOG_FOLDERS),
      folders: kStrings
    }),
    z.object({
      type: z.literal(CATALOG_TAGS_CHANGED),
      assetId: kString,
      tags: kTags
    }),
    z.union([
      appliedVariant(z.literal(CATALOG_CREATE), {
        assetId: kString
      }),
      appliedVariant(z.enum([CATALOG_RENAME, CATALOG_DELETE]), {
        applied: z.int().check(z.minimum(0)),
        failure: z.optional(kString)
      }),
      appliedVariant(z.enum([
        CATALOG_CREATE_FOLDER,
        CATALOG_MOVE_FOLDER,
        CATALOG_DELETE_FOLDER
      ]), {
        path: kString
      }),
      appliedVariant(z.literal(CATALOG_EXPORT), {
        content: assetInlineContentSchema
      }),
      appliedVariant(z.literal(CATALOG_PLAN), {
        plan: importPlanSchema
      }),
      appliedVariant(z.literal(CATALOG_IMPORT), {
        report: importReportSchema
      }),
      appliedVariant(z.literal(CATALOG_TAGS), {
        assetId: kString,
        tags: kTags
      }),
      appliedVariant(z.literal(CATALOG_TAG), {
        tag: assetTagSchema
      }),
      appliedVariant(z.literal(CATALOG_UNTAG), {
        assetId: kString,
        name: kString
      }),
      appliedVariant(z.literal(CATALOG_RESTORE), {
        report: restoreReportSchema
      }),
      appliedVariant(z.literal(CATALOG_REPLACE), {
        assetId: kString,
        report: replaceReportSchema
      })
    ]),
    requestVariant(CATALOG_REJECTED, {
      command: z.enum(kCommandTypes),
      reason: kString
    })
  ]),
  {
    discriminator: "type"
  }
);

export const catalogProtocols: MessageProtocols = {
  inbound: catalogCommandProtocol,
  outbound: catalogMessageProtocol
};
