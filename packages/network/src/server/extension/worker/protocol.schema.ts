// Import Internal Dependencies
import { defineSchema } from "../../../protocol/schema.ts";

const kIdentifier = { type: "string" } as const;
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
        "args"
      ]
    },
    {
      type: "object",
      properties: {
        type: { const: "dispatch" },
        id: kIdentifier,
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
        "args"
      ]
    },
    {
      type: "object",
      properties: {
        type: { const: "dispatch" },
        id: kIdentifier,
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
        "args"
      ]
    },
    {
      type: "object",
      properties: {
        type: { const: "context-response" },
        id: kIdentifier,
        ok: { type: "boolean" },
        value: {},
        error: kIdentifier
      },
      required: [
        "type",
        "id",
        "ok"
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
        id: kIdentifier,
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
        id: kIdentifier,
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
    },
    {
      type: "object",
      properties: {
        type: { const: "context-call" },
        method: { const: "eventStore.append" },
        id: kIdentifier,
        args: {
          type: "array",
          prefixItems: [kAnyObject],
          minItems: 1
        }
      },
      required: [
        "type",
        "method",
        "id",
        "args"
      ]
    },
    {
      type: "object",
      properties: {
        type: { const: "context-call" },
        method: { const: "eventStore.list" },
        id: kIdentifier,
        args: {
          type: "array",
          prefixItems: [kIdentifier, {}],
          minItems: 1
        }
      },
      required: [
        "type",
        "method",
        "id",
        "args"
      ]
    }
  ]
});
