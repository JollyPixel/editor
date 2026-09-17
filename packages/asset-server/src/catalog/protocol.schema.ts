// Import Third-party Dependencies
import {
  defineMessageProtocol,
  type MessageProtocols
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_DELETE,
  CATALOG_REJECTED,
  CATALOG_RENAME,
  CATALOG_SNAPSHOT
} from "./client/protocol.ts";
import { assetInlineContentSchema } from "../events/AssetEvents.schema.ts";

// CONSTANTS
const kString = { type: "string" } as const;

export const catalogCommandProtocol = defineMessageProtocol({
  discriminator: "type",
  schema: {
    oneOf: [
      {
        type: "object",
        properties: {
          type: { const: CATALOG_CREATE },
          requestId: kString,
          path: kString,
          kind: kString,
          onConflict: { enum: ["reject", "suffix"] },
          content: assetInlineContentSchema
        },
        required: [
          "type",
          "path",
          "content"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_RENAME },
          requestId: kString,
          assetId: kString,
          to: kString
        },
        required: [
          "type",
          "assetId",
          "to"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_DELETE },
          requestId: kString,
          assetId: kString
        },
        required: [
          "type",
          "assetId"
        ]
      }
    ]
  }
});

export const catalogMessageProtocol = defineMessageProtocol({
  discriminator: "type",
  schema: {
    oneOf: [
      {
        type: "object",
        properties: {
          type: { const: CATALOG_SNAPSHOT },
          manifest: { type: "object" }
        },
        required: [
          "type",
          "manifest"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_CHANGED },
          change: { type: "object" }
        },
        required: [
          "type",
          "change"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_APPLIED },
          requestId: kString,
          command: kString,
          assetId: kString
        },
        required: [
          "type",
          "command",
          "assetId"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: CATALOG_REJECTED },
          requestId: kString,
          command: kString,
          reason: kString
        },
        required: [
          "type",
          "command",
          "reason"
        ]
      }
    ]
  }
});

export const catalogProtocols: MessageProtocols = {
  inbound: catalogCommandProtocol,
  outbound: catalogMessageProtocol
};
