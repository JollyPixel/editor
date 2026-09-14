// Import Third-party Dependencies
import {
  defineMessageProtocol,
  type MessageProtocols
} from "@jolly-pixel/network";

// CONSTANTS
export const CATALOG_SNAPSHOT = "catalog:snapshot";
export const CATALOG_CHANGED = "catalog:changed";
export const CATALOG_APPLIED = "catalog:applied";
export const CATALOG_REJECTED = "catalog:rejected";

export const CATALOG_CREATE = "catalog:create";
export const CATALOG_RENAME = "catalog:rename";
export const CATALOG_DELETE = "catalog:delete";

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
          content: {
            type: "object",
            properties: {
              type: { const: "inline" },
              encoding: { const: "base64" },
              data: kString
            },
            required: [
              "type",
              "encoding",
              "data"
            ]
          }
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
