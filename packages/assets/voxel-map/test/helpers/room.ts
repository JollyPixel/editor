// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { VoxelWorldJSON } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "#src/network/types.ts";

export interface MockRoom extends network.Room<VoxelNetworkCommand, VoxelServerMessage> {
  sentCommands: VoxelNetworkCommand[];
  left: boolean;
  simulateCommand(cmd: VoxelNetworkCommand): void;
  simulateSnapshot(snapshot: VoxelWorldJSON): void;
}

export function createMockRoom(clientId = "client-A"): MockRoom {
  const sentCommands: VoxelNetworkCommand[] = [];
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  function emit(type: string, payload: unknown): void {
    for (const listener of listeners.get(type) ?? []) {
      listener(payload);
    }
  }

  const room: MockRoom = {
    id: "test-room",
    clientId,
    peers: new Map(),

    role: "default",

    rights: {},

    access: "write" as const,

    can: () => "write" as const,
    sentCommands,
    left: false,
    on: (type, listener) => {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener as (payload: unknown) => void);
    },
    off: (type, listener) => {
      listeners.get(type)?.delete(listener as (payload: unknown) => void);
    },
    join() {
      return void 0;
    },
    send(cmd) {
      sentCommands.push(cmd);
    },
    updatePresence() {
      return void 0;
    },
    leave() {
      room.left = true;
    },
    simulateCommand(cmd) {
      emit("message", { type: "command", data: cmd });
    },
    simulateSnapshot(snapshot) {
      emit("message", { type: "snapshot", data: snapshot });
    }
  };

  return room;
}
