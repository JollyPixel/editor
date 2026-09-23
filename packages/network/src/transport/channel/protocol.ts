// Import Internal Dependencies
import type {
  ClientSocketEvent,
  ClientSocketEventType
} from "../../client/Client.ts";

// CONSTANTS
export const CHANNEL_TRANSPORT_TAG = "jolly-pixel.channel-transport";

type PortListener = (event: { data: unknown; }) => void;

/**
 * The part of a `BroadcastChannel`, `MessagePort` or `Worker` the channel
 * transport relies on. `start()` is called when present, as a `MessagePort`
 * only delivers to `addEventListener` listeners once started.
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
}

interface ChannelTransportAddress {
  tag: typeof CHANNEL_TRANSPORT_TAG;
  host: string;
  socket: string;
}

export type ChannelTransportMessage =
  | ChannelTransportAddress & { type: "connect"; }
  | ChannelTransportAddress & { type: "send"; data: string; }
  | ChannelTransportAddress & { type: "close"; }
  | ChannelTransportAddress & {
    type: "event";
    event: ClientSocketEventType;
    data: ClientSocketEvent;
  };

export function isChannelTransportMessage(
  value: unknown
): value is ChannelTransportMessage {
  return typeof value === "object" &&
    value !== null &&
    "tag" in value &&
    value.tag === CHANNEL_TRANSPORT_TAG;
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
