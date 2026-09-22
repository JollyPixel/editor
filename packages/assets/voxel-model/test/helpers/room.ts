// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  VoxelModelNetworkCommand,
  VoxelModelRoom,
  VoxelModelServerMessage,
  VoxelModelSnapshot
} from "#src/network/types.ts";

export interface MockRoom extends VoxelModelRoom {
  readonly sent: VoxelModelNetworkCommand[];
  joins: number;
  leaves: number;
  deliverCommand(command: VoxelModelNetworkCommand): void;
  deliverSnapshot(snapshot: VoxelModelSnapshot): void;
}

export function createMockRoom(
  clientId = "client-A"
): MockRoom {
  const listeners = new Map<string, Set<(payload: never) => void>>();
  const sent: VoxelModelNetworkCommand[] = [];

  function emit(
    type: string,
    payload: VoxelModelServerMessage
  ): void {
    for (const listener of listeners.get(type) ?? []) {
      (listener as (message: VoxelModelServerMessage) => void)(payload);
    }
  }

  const room: MockRoom = {
    id: "model-room",
    clientId,
    peers: new Map(),
    role: "default",
    rights: {},
    access: "write",
    sent,
    joins: 0,
    leaves: 0,
    can: (): network.Right => "write",
    join: () => {
      room.joins++;
    },
    leave: () => {
      room.leaves++;
    },
    send: (command) => {
      sent.push(command as VoxelModelNetworkCommand);
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
    deliverCommand: (command) => emit("message", {
      type: "command",
      data: command
    }),
    deliverSnapshot: (snapshot) => emit("message", {
      type: "snapshot",
      data: snapshot
    })
  };

  return room;
}
