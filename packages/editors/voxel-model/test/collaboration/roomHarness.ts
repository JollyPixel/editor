// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import { Emitter } from "@openally/emitt";
import type {
  VoxelModelRoom,
  VoxelModelServerMessage
} from "@jolly-pixel/asset.voxel-model/client";

type RoomEvents = network.RoomEventMap<VoxelModelServerMessage>;

export type RoomEvent =
  | "peer-joined"
  | "peer-left"
  | "peer-presence";

export interface RoomHarness {
  room: VoxelModelRoom;
  published: network.PeerMetadata[];
  addPeer(
    clientId: string,
    options?: {
      profile?: network.PeerMetadata;
      presence?: network.PeerMetadata;
    }
  ): void;
  removePeer(
    clientId: string
  ): void;
  emitSync(): void;
  emit<K extends RoomEvent>(
    event: K,
    ...args: Parameters<RoomEvents[K]>
  ): void;
  listenerCount(
    event: keyof RoomEvents
  ): number;
}

export function createRoomHarness(): RoomHarness {
  const peers = new Map<string, network.Peer>();
  const events = new Emitter<RoomEvents>();
  const published: network.PeerMetadata[] = [];

  const room: VoxelModelRoom = {
    id: "model-room",
    clientId: "local",
    peers,
    role: "default",
    rights: {},
    access: "write",
    can: () => "write",
    join: () => void 0,
    leave: () => void 0,
    send: () => void 0,
    updatePresence: (patch) => {
      published.push(patch);
    },
    on: (type, listener) => {
      events.on(type, listener);
    },
    off: (type, listener) => {
      events.off(type, listener);
    }
  };

  return {
    room,
    published,
    addPeer(clientId, options = {}) {
      peers.set(clientId, {
        clientId,
        role: "default",
        profile: options.profile ?? {
          username: clientId,
          peerId: clientId
        },
        presence: options.presence ?? {}
      });
    },
    removePeer(clientId) {
      peers.delete(clientId);
    },
    emitSync() {
      events.emit("sync", {
        self: room.clientId,
        clientIds: [...peers.keys()]
      });
    },
    emit(event, ...args) {
      events.emit(event, ...args);
    },
    listenerCount(event) {
      return events.listenerCount(event);
    }
  };
}
