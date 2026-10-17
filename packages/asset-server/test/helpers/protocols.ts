// Import Third-party Dependencies
import {
  MessageProtocol,
  OPAQUE_PROTOCOLS,
  withEvent,
  type MessageProtocols,
  type Schema
} from "@jolly-pixel/network";
import * as z from "zod/mini";

export { OPAQUE_PROTOCOLS };

export const counterIncrementProtocol: MessageProtocol = new MessageProtocol(
  z.union([
    withEvent(z.object({
      increment: z.boolean()
    }), "increment")
  ])
);

export const counterProtocols: MessageProtocols = {
  inbound: counterIncrementProtocol,
  outbound: null
};

export const counterCommandProtocol: MessageProtocol = new MessageProtocol(
  z.union([
    z.object({
      action: z.literal("increment")
    })
  ])
);

export const counterSnapshotSchema: Schema = z.record(z.string(), z.unknown());

export const linkSnapshotSchema: Schema = z.record(z.string(), z.unknown());

export const linkCommandProtocol: MessageProtocol = new MessageProtocol(
  z.union([
    z.object({
      action: z.literal("set"),
      targets: z.array(z.string())
    })
  ])
);
