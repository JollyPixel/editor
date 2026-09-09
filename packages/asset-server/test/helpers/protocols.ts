// Import Third-party Dependencies
import {
  defineMessageProtocol,
  OPAQUE_PROTOCOLS,
  serverMessageProtocol,
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

export const counterCommandProtocols: MessageProtocols = {
  inbound: counterCommandProtocol,
  outbound: serverMessageProtocol({
    command: counterCommandProtocol,
    snapshot: { type: "object" }
  })
};
