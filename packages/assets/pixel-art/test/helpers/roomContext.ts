// Import Third-party Dependencies
import type { RoomContext } from "@jolly-pixel/network";

export interface ObservedRoomContext {
  context: RoomContext;
  broadcasts: unknown[];
}

export function createRoomContext(): ObservedRoomContext {
  const broadcasts: unknown[] = [];
  const context: RoomContext = {
    actor: {
      type: "user",
      id: "client-1"
    },
    room: {
      broadcast: (payload) => broadcasts.push(payload),
      sendTo: (_clientId, payload) => broadcasts.push(payload)
    },
    eventStore: {
      append: async() => true,
      list: async() => []
    }
  };

  return {
    context,
    broadcasts
  };
}
