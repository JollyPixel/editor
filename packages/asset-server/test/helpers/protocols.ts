// Import Third-party Dependencies
import {
  MessageProtocol,
  OPAQUE_PROTOCOLS,
  type JSONSchema,
  type MessageProtocols
} from "@jolly-pixel/network";

export { OPAQUE_PROTOCOLS };

export const counterIncrementProtocol: MessageProtocol = new MessageProtocol({
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
});

export const counterProtocols: MessageProtocols = {
  inbound: counterIncrementProtocol,
  outbound: null
};

export const counterCommandProtocol: MessageProtocol = new MessageProtocol({
  oneOf: [
    {
      type: "object",
      properties: {
        action: { const: "increment" }
      },
      required: ["action"]
    }
  ]
});

export const counterSnapshotSchema: JSONSchema = {
  type: "object"
};

export const linkSnapshotSchema: JSONSchema = {
  type: "object"
};

export const linkCommandProtocol: MessageProtocol = new MessageProtocol({
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
});
