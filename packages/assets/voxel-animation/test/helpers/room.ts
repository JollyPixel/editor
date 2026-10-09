// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  AnimationNetworkCommand,
  AnimationRoom,
  AnimationServerMessage
} from "#src/network/types.ts";

export interface MockRoom extends AnimationRoom {
  readonly sent: AnimationNetworkCommand[];
  deliver(message: AnimationServerMessage): void;
}

export function createMockRoom(
  clientId = "client-A"
): MockRoom {
  const listeners = new Map<string, Set<(payload: never) => void>>();
  const sent: AnimationNetworkCommand[] = [];

  const room: MockRoom = {
    id: "animation-room",
    clientId,
    peers: new Map(),
    profile: null,
    role: "default",
    rights: {},
    access: "write",
    sent,
    can: (): network.Right => "write",
    join: () => void 0,
    leave: () => void 0,
    resync: () => void 0,
    resumeWith: () => void 0,
    send: (command) => {
      sent.push(command as AnimationNetworkCommand);
    },
    updatePresence: () => void 0,
    on: (type, listener) => {
      let set = listeners.get(type);
      if (set === undefined) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener as (payload: never) => void);
    },
    off: (type, listener) => {
      listeners.get(type)?.delete(listener as (payload: never) => void);
    },
    deliver: (message) => {
      for (const listener of listeners.get("message") ?? []) {
        (listener as (payload: AnimationServerMessage) => void)(message);
      }
    }
  };

  return room;
}
