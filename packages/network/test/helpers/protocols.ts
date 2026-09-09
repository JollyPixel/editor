// Import Internal Dependencies
import {
  defineMessageProtocol,
  serverMessageProtocol,
  OPAQUE_PROTOCOLS,
  type MessageProtocols
} from "#src/protocol/MessageProtocol.ts";
import { defineSchema } from "#src/protocol/schema.ts";

export { OPAQUE_PROTOCOLS };

export const actionCommandProtocol = defineMessageProtocol({
  schema: defineSchema({
    oneOf: [
      {
        type: "object",
        properties: {
          action: { const: "voxel-set" }
        },
        required: ["action"]
      },
      {
        type: "object",
        properties: {
          action: { const: "object-added" }
        },
        required: ["action"]
      }
    ]
  })
});

export const actionProtocols: MessageProtocols = {
  inbound: actionCommandProtocol,
  outbound: actionCommandProtocol
};

export const syncProtocols: MessageProtocols = {
  inbound: actionCommandProtocol,
  outbound: serverMessageProtocol({
    command: actionCommandProtocol,
    snapshot: { type: "object" }
  })
};
