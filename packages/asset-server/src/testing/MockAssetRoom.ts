// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type {
  NetworkServerMessage,
  Peer,
  Right,
  Room,
  RoomEventMap
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetRoomNotice } from "../kinds/AssetLiveProtocol.ts";

export type AssetServerMessage<TCommand, TSnapshot> = NetworkServerMessage<
  TCommand,
  TSnapshot,
  AssetRoomNotice
>;

type MockRoomEvents<TCommand, TSnapshot> = RoomEventMap<
  AssetServerMessage<TCommand, TSnapshot>
>;

export interface MockAssetRoom<TCommand, TSnapshot>
  extends Room<TCommand, AssetServerMessage<TCommand, TSnapshot>> {
  readonly sent: TCommand[];
  readonly peers: Map<string, Peer>;
  joins: number;
  leaves: number;
  resyncs: number;
  deliver(
    message: AssetServerMessage<TCommand, TSnapshot>
  ): void;
  emit<K extends keyof MockRoomEvents<TCommand, TSnapshot>>(
    type: K,
    ...args: Parameters<MockRoomEvents<TCommand, TSnapshot>[K]>
  ): void;
}

export function mockAssetRoom<TCommand, TSnapshot>(
  clientId = "client-A"
): MockAssetRoom<TCommand, TSnapshot> {
  const events = new Emitter<MockRoomEvents<TCommand, TSnapshot>>();

  const room: MockAssetRoom<TCommand, TSnapshot> = {
    id: "asset-room",
    clientId,
    peers: new Map(),
    profile: {},
    role: "default",
    rights: {},
    access: "write",
    sent: [],
    joins: 0,
    leaves: 0,
    resyncs: 0,
    can: (): Right => "write",
    join: () => {
      room.joins++;
    },
    leave: () => {
      room.leaves++;
    },
    resync: () => {
      room.resyncs++;
    },
    resumeWith: () => void 0,
    send: (command) => {
      room.sent.push(command);
    },
    updatePresence: () => void 0,
    on: (type, listener) => {
      events.on(type, listener);
    },
    off: (type, listener) => {
      events.off(type, listener);
    },
    deliver: (message) => {
      room.emit("message", message);
    },
    emit: (type, ...args) => {
      events.emit(type, ...args);
    }
  };

  return room;
}
