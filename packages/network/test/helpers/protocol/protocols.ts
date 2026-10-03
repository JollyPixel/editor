// Import Internal Dependencies
import {
  MessageProtocol,
  OPAQUE_PROTOCOLS,
  type MessageProtocols
} from "#src/protocol/message/MessageProtocol.ts";
import { serverMessageProtocol } from "#src/sync/serverMessageProtocol.ts";

export { OPAQUE_PROTOCOLS };

export const actionCommandProtocol = new MessageProtocol({
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
