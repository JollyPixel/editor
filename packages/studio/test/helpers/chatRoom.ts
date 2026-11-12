// Import Third-party Dependencies
import type {
  Peer,
  PeerMetadata,
  Right
} from "@jolly-pixel/network/client";
import {
  AGENT_CHAT_HISTORY,
  AGENT_CHAT_SAID,
  AGENT_CHAT_SAY,
  type AgentChatEntry
} from "@jolly-pixel/server";
import type { AgentChatRoom } from "@jolly-pixel/server/client";

export interface ChatRoomHarness {
  room: AgentChatRoom;
  addPeer(
    clientId: string,
    profile: PeerMetadata,
    presence?: PeerMetadata
  ): void;
  history(
    entries?: AgentChatEntry[]
  ): void;
  said(
    entry: AgentChatEntry
  ): void;
}

export function chatRoomHarness(
  sayRight: Right = "write"
): ChatRoomHarness {
  const peers = new Map<string, Peer>();
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  function emit(
    event: string,
    payload: unknown
  ): void {
    for (const listener of listeners.get(event) ?? []) {
      listener(payload);
    }
  }

  const room = {
    id: "agent-chat",
    clientId: "local",
    peers,
    profile: {},
    role: "member",
    rights: {},
    access: "write",
    can: (event: string): Right => (event === AGENT_CHAT_SAY ? sayRight : "void"),
    join: () => undefined,
    leave: () => undefined,
    send: () => undefined,
    updatePresence: () => undefined,
    resync: () => undefined,
    resumeWith: () => undefined,
    on: (event: string, listener: (payload: unknown) => void) => {
      const bucket = listeners.get(event) ?? new Set();
      bucket.add(listener);
      listeners.set(event, bucket);
    },
    off: (event: string, listener: (payload: unknown) => void) => {
      listeners.get(event)?.delete(listener);
    }
  } satisfies Record<keyof AgentChatRoom, unknown>;

  return {
    room: room as unknown as AgentChatRoom,
    addPeer(
      clientId,
      profile,
      presence = {}
    ) {
      peers.set(clientId, {
        clientId,
        role: "member",
        profile,
        presence
      });
      emit("peer-joined", { clientId });
    },
    history(entries = []) {
      emit("message", {
        type: AGENT_CHAT_HISTORY,
        messages: entries
      });
    },
    said(entry) {
      emit("message", {
        type: AGENT_CHAT_SAID,
        ...entry
      });
    }
  };
}
