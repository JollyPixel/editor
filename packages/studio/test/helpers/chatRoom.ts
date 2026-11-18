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
  readonly published: PeerMetadata[];
  readonly sent: unknown[];
  patchPresence(
    clientId: string,
    patch: PeerMetadata
  ): void;
  removePeer(
    clientId: string
  ): void;
  history(
    entries?: AgentChatEntry[]
  ): void;
  said(
    entry: AgentChatEntry
  ): void;
}

export function chatRoomHarness(
  sayRight: Right = "write",
  profile: PeerMetadata = {}
): ChatRoomHarness {
  const peers = new Map<string, Peer>();
  const published: PeerMetadata[] = [];
  const sent: unknown[] = [];
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
    profile,
    role: "member",
    rights: {},
    access: "write",
    can: (event: string): Right => (event === AGENT_CHAT_SAY ? sayRight : "void"),
    join: () => undefined,
    leave: () => undefined,
    send: (payload: unknown) => {
      sent.push(payload);
    },
    updatePresence: (patch: PeerMetadata) => {
      published.push(patch);
    },
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
    published,
    sent,
    patchPresence(clientId, patch) {
      const peer = peers.get(clientId);
      if (peer !== undefined) {
        peers.set(clientId, {
          ...peer,
          presence: {
            ...peer.presence,
            ...patch
          }
        });
        emit("peer-presence", { clientId, patch });
      }
    },
    removePeer(clientId) {
      peers.delete(clientId);
      emit("peer-left", { clientId });
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
