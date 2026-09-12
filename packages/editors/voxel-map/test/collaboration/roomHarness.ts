// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

export type RoomEvent =
  | "sync"
  | "peer-joined"
  | "peer-left"
  | "peer-presence";

export interface RoomHarness {
  room: network.Room<any, any>;
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
  emit(
    event: RoomEvent,
    payload?: unknown
  ): void;
  listenerCount(
    event: RoomEvent
  ): number;
}

export function createRoomHarness(): RoomHarness {
  const peers = new Map<string, network.Peer>();
  const listeners = new Map<string, Set<(payload: any) => void>>();
  const published: network.PeerMetadata[] = [];

  const room = {
    id: "voxel-room",
    clientId: "local",
    peers,
    role: "default",
    rights: {},
    access: "write" as const,
    can: () => "write" as const,
    join: () => void 0,
    leave: () => void 0,
    send: () => void 0,
    updatePresence: (patch: network.PeerMetadata) => {
      published.push(patch);
    },
    on: (event: string, listener: (payload: any) => void) => {
      let bucket = listeners.get(event);
      if (!bucket) {
        bucket = new Set();
        listeners.set(event, bucket);
      }
      bucket.add(listener);
    },
    off: (event: string, listener: (payload: any) => void) => {
      listeners.get(event)?.delete(listener);
    }
  } as unknown as network.Room<any, any>;

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
    emit(event, payload) {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload);
      }
    },
    listenerCount(event) {
      return listeners.get(event)?.size ?? 0;
    }
  };
}
