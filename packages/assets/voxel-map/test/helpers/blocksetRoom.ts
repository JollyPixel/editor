// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  BlocksetNetworkCommand,
  BlocksetServerMessage,
  BlocksetSnapshot
} from "#src/network/blockset/types.ts";

export interface MockBlocksetRoom extends network.Room<
  BlocksetNetworkCommand,
  BlocksetServerMessage
> {
  sentCommands: BlocksetNetworkCommand[];
  resyncs: number;
  simulateCommand(cmd: BlocksetNetworkCommand): void;
  simulateSnapshot(snapshot: BlocksetSnapshot): void;
  deliver(message: BlocksetServerMessage): void;
}

export function createMockBlocksetRoom(
  clientId = "client-A"
): MockBlocksetRoom {
  const sentCommands: BlocksetNetworkCommand[] = [];
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  function emit(type: string, payload: unknown): void {
    for (const listener of listeners.get(type) ?? []) {
      listener(payload);
    }
  }

  const room: MockBlocksetRoom = {
    id: "blockset-room",
    clientId,
    peers: new Map(),
    role: "default",
    rights: {},
    access: "write" as const,
    can: () => "write" as const,
    sentCommands,
    resyncs: 0,
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
      return void 0;
    },
    resync() {
      room.resyncs++;
    },
    resumeWith() {
      return void 0;
    },
    simulateCommand(cmd) {
      emit("message", { type: "command", data: cmd });
    },
    simulateSnapshot(snapshot) {
      emit("message", { type: "snapshot", data: snapshot });
    },
    deliver(message) {
      emit("message", message);
    }
  };

  return room;
}
