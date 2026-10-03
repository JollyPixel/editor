// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import type { ClientSocketEvent } from "../ClientSocket.ts";

// CONSTANTS
export const CHANNEL_TRANSPORT_TAG = "jolly-pixel.channel-transport";

const kAddressShape = {
  tag: z.literal(CHANNEL_TRANSPORT_TAG),
  host: z.string(),
  socket: z.string()
};

const kSocketEventTypeSchema = z.enum([
  "open",
  "message",
  "error",
  "close"
]);

const kSocketEventSchema = z.object({
  data: z.optional(z.unknown()),
  code: z.optional(z.number()),
  reason: z.optional(z.string())
});

const kChannelTransportMessageSchema = z.discriminatedUnion("type", [
  z.object({
    ...kAddressShape,
    type: z.literal("connect"),
    dedicated: z.boolean()
  }),
  z.object({
    ...kAddressShape,
    type: z.literal("send"),
    data: z.string()
  }),
  z.object({
    ...kAddressShape,
    type: z.literal("close")
  }),
  z.object({
    ...kAddressShape,
    type: z.literal("event"),
    event: kSocketEventTypeSchema,
    data: kSocketEventSchema
  })
]);

type PortListener = (event: { data: unknown; }) => void;

/**
 * The part of a `BroadcastChannel`, `MessagePort` or `Worker` the channel
 * transport relies on. `start()` is called when present, as a `MessagePort`
 * only delivers to `addEventListener` listeners once started. `close()` is
 * called on a per-socket port when its socket closes.
 */
export interface ChannelPort {
  postMessage(
    message: unknown
  ): void;

  addEventListener(
    type: "message",
    listener: PortListener
  ): void;

  removeEventListener(
    type: "message",
    listener: PortListener
  ): void;

  start?(): void;

  close?(): void;
}

export type ChannelSocketPortFactory = (
  socket: string
) => ChannelPort;

export type ChannelTransportMessage = z.infer<
  typeof kChannelTransportMessageSchema
>;

export function parseChannelTransportMessage(
  value: unknown
): ChannelTransportMessage | undefined {
  const result = kChannelTransportMessageSchema.safeParse(value);

  return result.success ? result.data : undefined;
}

export function isChannelTransportMessage(
  value: unknown
): value is ChannelTransportMessage {
  return kChannelTransportMessageSchema.safeParse(value).success;
}

export function toPlainEvent(
  event: ClientSocketEvent
): ClientSocketEvent {
  const { data, code, reason } = event;

  return {
    ...(data === undefined ? {} : { data }),
    ...(code === undefined ? {} : { code }),
    ...(reason === undefined ? {} : { reason })
  };
}
