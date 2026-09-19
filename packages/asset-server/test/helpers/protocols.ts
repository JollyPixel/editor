// Import Third-party Dependencies
import {
  defineMessageProtocol,
  OPAQUE_PROTOCOLS,
  type JSONSchema,
  type MessageProtocol,
  type MessageProtocols
} from "@jolly-pixel/network";

export { OPAQUE_PROTOCOLS };

export const counterIncrementProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: [
      {
        title: "increment",
        type: "object",
        properties: {
          increment: { type: "boolean" }
        },
        required: ["increment"]
      }
    ]
  }
});

export const counterProtocols: MessageProtocols = {
  inbound: counterIncrementProtocol,
  outbound: null
};

export const counterCommandProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: [
      {
        type: "object",
        properties: {
          action: { const: "increment" }
        },
        required: ["action"]
      }
    ]
  }
});

export const counterSnapshotSchema: JSONSchema = {
  type: "object"
};

export const linkCommandProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: [
      {
        type: "object",
        properties: {
          action: { const: "set" },
          targets: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["action", "targets"]
      }
    ]
  }
});
