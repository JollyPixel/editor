// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  MessageProtocol,
  OPAQUE_PROTOCOLS,
  withEvent,
  type MessageProtocols
} from "#src/protocol/message/MessageProtocol.ts";
import { SNAPSHOT_EVENT } from "#src/protocol/constants.ts";

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
  outbound: new MessageProtocol(
    z.union([
      withEvent(z.object({
        type: z.literal("snapshot"),
        data: z.object({})
      }), SNAPSHOT_EVENT),
      ...actionCommandProtocol.variants.map(({ event, schema }) => withEvent(
        z.object({
          type: z.literal("command"),
          data: schema,
          version: z.optional(z.int().check(z.minimum(0)))
        }),
        event
      ))
    ]),
    {
      discriminator: "type"
    }
  )
};
