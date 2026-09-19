// Import Third-party Dependencies
import type {
  Peer,
  PeerMetadata,
  Room
} from "@jolly-pixel/network/client";

export type RoomEvent =
  | "sync"
  | "peer-joined"
  | "peer-left"
  | "peer-presence";

export interface RoomHarness {
  room: Room;
  published: PeerMetadata[];
  addPeer(
    clientId: string,
    options?: {
      profile?: PeerMetadata;
      presence?: PeerMetadata;
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
  const peers = new Map<string, Peer>();
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const published: PeerMetadata[] = [];

  const room = {
    id: "room",
    clientId: "local",
    peers,
    role: "default",
    rights: {},
    access: "write" as const,
    can: () => "write" as const,
    join: () => void 0,
    leave: () => void 0,
    send: () => void 0,
    updatePresence: (patch: PeerMetadata) => {
      published.push(patch);
    },
    on: (event: string, listener: (payload: unknown) => void) => {
      const bucket = listeners.get(event) ?? new Set();
      bucket.add(listener);
      listeners.set(event, bucket);
    },
    off: (event: string, listener: (payload: unknown) => void) => {
      listeners.get(event)?.delete(listener);
    }
  } as unknown as Room;

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
