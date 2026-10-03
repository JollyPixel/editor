// Import Third-party Dependencies
import type {
  ClientHandle,
  RoomContext,
  RoomPeer
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  AssetCommands,
  AssetRoomBinding
} from "#src/index.ts";
import { counterCommandProtocol } from "./protocols.ts";

// CONSTANTS
export const COUNTER_ROOM_ASSET_ID = "asset-1";
export const COUNTER_COMMAND = "counter.command";

export interface RecordingClient extends ClientHandle {
  readonly received: unknown[];
}

export interface DirectMessage {
  clientId: string;
  payload: unknown;
}

export interface RecordingRoom {
  readonly context: RoomContext;
  readonly broadcasts: unknown[];
  readonly direct: DirectMessage[];
}

export function recordingClient(
  id: string
): RecordingClient {
  const received: unknown[] = [];

  return {
    id,
    received,
    send: (payload) => received.push(payload)
  };
}

export function roomPeer(
  clientId: string,
  resume?: unknown
): RoomPeer {
  return {
    clientId,
    identity: {
      subject: clientId,
      role: "default"
    },
    profile: {},
    presence: {},
    ...(resume === undefined ? {} : { resume })
  };
}

export function recordingRoom(): RecordingRoom {
  const broadcasts: unknown[] = [];
  const direct: DirectMessage[] = [];

  return {
    broadcasts,
    direct,
    context: {
      room: {
        broadcast: (payload) => broadcasts.push(payload),
        sendTo: (clientId, payload) => direct.push({ clientId, payload })
      },
      identity: {
        subject: "alice-subject",
        role: "default"
      }
    }
  };
}

export function counterRoomBinding(
  overrides: Partial<AssetRoomBinding> = {}
): AssetRoomBinding {
  return {
    assetId: COUNTER_ROOM_ASSET_ID,
    kind: "counter",
    roomId: `counter:${COUNTER_ROOM_ASSET_ID}`,
    state: null,
    ...overrides
  };
}

export function counterRoomCommands<TCommand>(): AssetCommands<unknown, TCommand> {
  return {
    eventType: COUNTER_COMMAND,
    protocol: counterCommandProtocol,
    apply: () => void 0
  };
}
