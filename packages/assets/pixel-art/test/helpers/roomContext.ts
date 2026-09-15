// Import Third-party Dependencies
import type { RoomContext } from "@jolly-pixel/network";

export interface ObservedRoomContext {
  context: RoomContext;
  broadcasts: unknown[];
}

export function createRoomContext(): ObservedRoomContext {
  const broadcasts: unknown[] = [];
  const context: RoomContext = {
    room: {
      broadcast: (payload) => broadcasts.push(payload),
      sendTo: (_clientId, payload) => broadcasts.push(payload)
    },
    identity: {
      subject: "client-1",
      role: "default"
    }
  };

  return {
    context,
    broadcasts
  };
}
