// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  MessageProtocol,
  OPAQUE_PROTOCOLS,
  type MessageProtocols
} from "#src/protocol/message/MessageProtocol.ts";
import { serverMessageProtocol } from "#src/sync/serverMessageProtocol.ts";

export { OPAQUE_PROTOCOLS };

export const actionCommandProtocol = new MessageProtocol(z.union([
  z.object({
    action: z.literal("voxel-set")
  }),
  z.object({
    action: z.literal("object-added")
  })
]));

export const actionProtocols: MessageProtocols = {
  inbound: actionCommandProtocol,
  outbound: actionCommandProtocol
};

export const syncProtocols: MessageProtocols = {
  inbound: actionCommandProtocol,
  outbound: serverMessageProtocol({
    command: actionCommandProtocol,
    snapshot: z.object({})
  })
};
