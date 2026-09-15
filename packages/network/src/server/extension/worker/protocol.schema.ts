// Import Internal Dependencies
import { defineSchema } from "../../../protocol/schema.ts";

const kIdentifier = { type: "string" } as const;
const kIdentity = {
  type: "object",
  properties: {
    subject: kIdentifier,
    role: kIdentifier
  },
  required: [
    "subject",
    "role"
  ]
} as const;
const kAnyObject = { type: "object" } as const;

export const hostWorkerDataSchema = defineSchema({
  type: "object",
  properties: {
    id: kIdentifier,
    modulePath: kIdentifier,
    exportName: kIdentifier,
    extensionWorkerData: {}
  },
  required: [
    "id",
    "modulePath"
  ]
});

export const mainToWorkerSchema = defineSchema({
  oneOf: [
    {
      type: "object",
      properties: {
        type: { const: "dispatch" },
        id: kIdentifier,
        identity: kIdentity,
        method: { const: "onClientConnect" },
        args: {
          type: "array",
          prefixItems: [
            kIdentifier,
            kAnyObject
          ],
          minItems: 2
        }
      },
      required: [
        "type",
        "id",
        "method",
        "args",
        "identity"
      ]
    },
    {
      type: "object",
      properties: {
        type: { const: "dispatch" },
        id: kIdentifier,
        identity: kIdentity,
        method: { const: "onClientDisconnect" },
        args: {
          type: "array",
          prefixItems: [kIdentifier],
          minItems: 1
        }
      },
      required: [
        "type",
        "id",
        "method",
        "args",
        "identity"
      ]
    },
    {
      type: "object",
      properties: {
        type: { const: "dispatch" },
        id: kIdentifier,
        identity: kIdentity,
        method: { const: "onMessage" },
        args: {
          type: "array",
          prefixItems: [kIdentifier, {}],
          minItems: 2
        }
      },
      required: [
        "type",
        "id",
        "method",
        "args",
        "identity"
      ]
    }
  ]
});

export const workerToMainSchema = defineSchema({
  oneOf: [
    {
      type: "object",
      properties: {
        type: { const: "ready" },
        methods: {
          type: "array",
          items: {
            enum: [
              "onClientConnect",
              "onClientDisconnect",
              "onMessage"
            ]
          }
        }
      },
      required: [
        "type",
        "methods"
      ]
    },
    {
      type: "object",
      properties: {
        type: { const: "dispatch-result" },
        id: kIdentifier,
        ok: { type: "boolean" },
        error: kIdentifier
      },
      required: [
        "type",
        "id",
        "ok"
      ]
    },
    {
      type: "object",
      properties: {
        type: { const: "context-call" },
        method: { const: "room.broadcast" },
        args: {
          type: "array",
          prefixItems: [{}],
          minItems: 1
        }
      },
      required: [
        "type",
        "method",
        "args"
      ]
    },
    {
      type: "object",
      properties: {
        type: { const: "context-call" },
        method: { const: "client.send" },
        args: {
          type: "array",
          prefixItems: [kIdentifier, {}],
          minItems: 2
        }
      },
      required: [
        "type",
        "method",
        "args"
      ]
    }
  ]
});
