// Import Third-party Dependencies
import {
  defineSchema,
  MessageProtocol,
  type MessageProtocols
} from "@jolly-pixel/network";

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
  CATALOG_SNAPSHOT
} from "./client/protocol.ts";
import {
  assetInlineContentSchema,
  assetReferenceSchema
} from "../events/AssetEvents.schema.ts";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED
} from "../events/AssetEvents.ts";
import { PATH_CONFLICT_POLICIES } from "../writer/AssetPathAllocator.ts";
import {
  IMPORT_CONFLICT_POLICIES,
  importPlanSchema,
  importReportSchema
} from "../archive/import/AssetImport.ts";

// CONSTANTS
const kString = { type: "string" } as const;
const kStrings = {
  type: "array",
  items: kString
} as const;
const kReferences = {
  type: "array",
  items: assetReferenceSchema
} as const;
const kRenameSchema = {
  type: "object",
  properties: {
    assetId: kString,
    to: kString
  },
  required: [
    "assetId",
    "to"
  ]
} as const;
const kCommandTypes = [
  CATALOG_CREATE,
  CATALOG_RENAME,
  CATALOG_DELETE,
  CATALOG_CREATE_FOLDER,
  CATALOG_MOVE_FOLDER,
  CATALOG_DELETE_FOLDER,
  CATALOG_EXPORT,
  CATALOG_PLAN,
  CATALOG_IMPORT
] as const;

export const assetRecordSchema = defineSchema({
  type: "object",
  properties: {
    id: kString,
    kind: kString,
    source: kString,
    revision: kString
  },
  required: [
    "id",
    "kind",
    "source"
  ]
});

export const catalogChangeSchema = defineSchema({
  type: "object",
  properties: {
    eventType: {
      enum: [
        ASSET_CREATED,
        ASSET_UPDATED,
        ASSET_RENAMED,
        ASSET_DELETED
      ]
    },
    assetId: kString,
    record: {
      oneOf: [
        assetRecordSchema,
        { type: "null" }
      ]
    },
    dependencies: kReferences
  },
  required: [
    "eventType",
    "assetId",
    "record"
  ]
});

export const dependencyMapSchema = defineSchema({
  type: "object",
  additionalProperties: kReferences
});

export const catalogCommandProtocol = new MessageProtocol(
  {
    oneOf: [
      {
        type: "object",
        properties: {
          type: { const: CATALOG_CREATE },
          requestId: kString,
          path: kString,
          kind: kString,
          onConflict: { enum: PATH_CONFLICT_POLICIES },
          content: assetInlineContentSchema
        },
        required: [
          "type",
          "requestId",
          "path"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_RENAME },
          requestId: kString,
          renames: {
            type: "array",
            minItems: 1,
            items: kRenameSchema
          }
        },
        required: [
          "type",
          "requestId",
          "renames"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_DELETE },
          requestId: kString,
          assetIds: {
            type: "array",
            minItems: 1,
            items: kString
          },
          force: { type: "boolean" }
        },
        required: [
          "type",
          "requestId",
          "assetIds"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_CREATE_FOLDER },
          requestId: kString,
          path: kString
        },
        required: [
          "type",
          "requestId",
          "path"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_MOVE_FOLDER },
          requestId: kString,
          from: kString,
          to: kString
        },
        required: [
          "type",
          "requestId",
          "from",
          "to"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_DELETE_FOLDER },
          requestId: kString,
          path: kString
        },
        required: [
          "type",
          "requestId",
          "path"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_EXPORT },
          requestId: kString,
          root: kString
        },
        required: [
          "type",
          "requestId"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_PLAN },
          requestId: kString,
          content: assetInlineContentSchema
        },
        required: [
          "type",
          "requestId",
          "content"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_IMPORT },
          requestId: kString,
          content: assetInlineContentSchema,
          onConflict: { enum: IMPORT_CONFLICT_POLICIES }
        },
        required: [
          "type",
          "requestId",
          "content",
          "onConflict"
        ]
      }
    ]
  },
  {
    discriminator: "type"
  }
);

export const catalogMessageProtocol = new MessageProtocol(
  {
    oneOf: [
      {
        type: "object",
        properties: {
          type: { const: CATALOG_SNAPSHOT },
          manifest: {
            type: "object",
            properties: {
              version: { const: 1 },
              assets: {
                type: "array",
                items: assetRecordSchema
              }
            },
            required: [
              "version",
              "assets"
            ]
          },
          dependencies: dependencyMapSchema,
          folders: kStrings
        },
        required: [
          "type",
          "manifest",
          "folders"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_CHANGED },
          changes: {
            type: "array",
            minItems: 1,
            items: catalogChangeSchema
          }
        },
        required: [
          "type",
          "changes"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_FOLDERS },
          folders: kStrings
        },
        required: [
          "type",
          "folders"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_APPLIED }
        },
        required: ["type"],
        oneOf: [
          {
            type: "object",
            properties: {
              type: { const: CATALOG_APPLIED },
              requestId: kString,
              command: { const: CATALOG_CREATE },
              assetId: kString
            },
            required: [
              "type",
              "requestId",
              "command",
              "assetId"
            ]
          },
          {
            type: "object",
            properties: {
              type: { const: CATALOG_APPLIED },
              requestId: kString,
              command: {
                enum: [
                  CATALOG_RENAME,
                  CATALOG_DELETE
                ]
              },
              applied: {
                type: "integer",
                minimum: 0
              },
              failure: kString
            },
            required: [
              "type",
              "requestId",
              "command",
              "applied"
            ]
          },
          {
            type: "object",
            properties: {
              type: { const: CATALOG_APPLIED },
              requestId: kString,
              command: {
                enum: [
                  CATALOG_CREATE_FOLDER,
                  CATALOG_MOVE_FOLDER,
                  CATALOG_DELETE_FOLDER
                ]
              },
              path: kString
            },
            required: [
              "type",
              "requestId",
              "command",
              "path"
            ]
          },
          {
            type: "object",
            properties: {
              type: { const: CATALOG_APPLIED },
              requestId: kString,
              command: { const: CATALOG_EXPORT },
              content: assetInlineContentSchema
            },
            required: [
              "type",
              "requestId",
              "command",
              "content"
            ]
          },
          {
            type: "object",
            properties: {
              type: { const: CATALOG_APPLIED },
              requestId: kString,
              command: { const: CATALOG_PLAN },
              plan: importPlanSchema
            },
            required: [
              "type",
              "requestId",
              "command",
              "plan"
            ]
          },
          {
            type: "object",
            properties: {
              type: { const: CATALOG_APPLIED },
              requestId: kString,
              command: { const: CATALOG_IMPORT },
              report: importReportSchema
            },
            required: [
              "type",
              "requestId",
              "command",
              "report"
            ]
          }
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_REJECTED },
          requestId: kString,
          command: { enum: kCommandTypes },
          reason: kString
        },
        required: [
          "type",
          "requestId",
          "command",
          "reason"
        ]
      }
    ]
  },
  {
    discriminator: "type"
  }
);

export const catalogProtocols: MessageProtocols = {
  inbound: catalogCommandProtocol,
  outbound: catalogMessageProtocol
};
