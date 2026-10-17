// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import type {
  ClientSocketEvent,
  ClientSocketEventType
} from "../ClientSocket.ts";

// CONSTANTS
export const CHANNEL_TRANSPORT_TAG = "jolly-pixel.channel-transport";
export const CHANNEL_SOCKET_EVENTS = [
  "open",
  "message",
  "error",
  "close"
] as const satisfies readonly ClientSocketEventType[];

const kAddressShape = {
  tag: z.literal(CHANNEL_TRANSPORT_TAG),
  host: z.string(),
  socket: z.string()
};

const kSocketEventSchema = z.object({
  data: z.optional(z.unknown()),
  code: z.optional(z.number()),
  reason: z.optional(z.string())
});

const kChannelMessageSchema = z.discriminatedUnion("type", [
  z.object({
    ...kAddressShape,
    type: z.literal("connect"),
    dedicated: z.boolean(),
    credential: z.optional(z.string())
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
    event: z.enum(CHANNEL_SOCKET_EVENTS),
    data: kSocketEventSchema
  })
]);

export type ChannelMessage = z.infer<
  typeof kChannelMessageSchema
>;

export function parseChannelMessage(
  value: unknown
): ChannelMessage | undefined {
  const result = kChannelMessageSchema.safeParse(value);

  return result.success ? result.data : undefined;
}

export function toWireEvent(
  event: ClientSocketEvent
): ClientSocketEvent {
  const { data, code, reason } = event;

  return {
    ...(data === undefined ? {} : { data }),
    ...(code === undefined ? {} : { code }),
    ...(reason === undefined ? {} : { reason })
  };
}
