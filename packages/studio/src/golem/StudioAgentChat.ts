// Import Third-party Dependencies
import {
  isAgentProfile,
  parseAgentProfile
} from "@jolly-pixel/accounts";
import type { Peer } from "@jolly-pixel/network/client";
import {
  AGENT_CHAT_SAY,
  parseAgentChatActivity,
  type AgentChatEntry
} from "@jolly-pixel/server";
import {
  AgentChatClient,
  type AgentChatRoomSource
} from "@jolly-pixel/server/client";
import type { Notifier } from "@jolly-pixel/ui";
import {
  formatPeerActivity,
  peerProfileColor
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { StudioAgentTokens } from "./StudioAgentTokens.ts";

// CONSTANTS
export const AGENT_CHAT_CHANGE = "change";
export const AGENT_CHAT_NOTIFICATION_SOURCE = "Golem chat";
const kRoomEvents = [
  "sync",
  "peer-joined",
  "peer-left",
  "peer-presence",
  "peer-profile"
] as const;

export type AgentTokenDisconnector = Pick<StudioAgentTokens, "disconnect">;

export interface ChatAgent {
  clientId: string;
  tokenId: string;
  ownerId: string;
  username: string;
  color: string;
  activity: ChatAgentActivity | null;
}

export interface ChatAgentActivity {
  label: string;
  assetId: string;
}

export interface ChatLine {
  entry: AgentChatEntry;
  color: string;
}

export class StudioAgentChat extends EventTarget implements Disposable {
  static join(
    rooms: AgentChatRoomSource,
    notifier: Notifier,
    tokens: AgentTokenDisconnector
  ): StudioAgentChat {
    return new StudioAgentChat(AgentChatClient.join(rooms), notifier, tokens);
  }

  #chat: AgentChatClient;
  #notifier: Notifier;
  #tokens: AgentTokenDisconnector;
  #visible = false;
  #unsubscribe: () => void;

  constructor(
    chat: AgentChatClient,
    notifier: Notifier,
    tokens: AgentTokenDisconnector
  ) {
    super();
    this.#chat = chat;
    this.#notifier = notifier;
    this.#tokens = tokens;
    this.#unsubscribe = chat.subscribe(this.#onSaid);
    void chat.ready.then(this.#changed, this.#changed);
    for (const event of kRoomEvents) {
      chat.room.on(event, this.#changed);
    }
  }

  get visible(): boolean {
    return this.#visible;
  }

  get canSay(): boolean {
    return this.#chat.room.can(AGENT_CHAT_SAY) === "write";
  }

  get lines(): ChatLine[] {
    return this.#chat.messages.map((entry) => {
      return {
        entry,
        color: peerProfileColor(entry.clientId, entry)
      };
    });
  }

  get agents(): ChatAgent[] {
    const byToken = new Map<string, ChatAgent>();
    for (const peer of this.#chat.room.peers.values()) {
      const agent = chatAgent(peer);
      if (agent !== null && !byToken.has(agent.tokenId)) {
        byToken.set(agent.tokenId, agent);
      }
    }

    return Array.from(byToken.values());
  }

  show(): void {
    this.#visible = true;
    this.#changed();
  }

  hide(): void {
    this.#visible = false;
    this.#changed();
  }

  async say(
    text: string
  ): Promise<void> {
    await this.#chat.say(text);
  }

  disconnect(
    agent: ChatAgent
  ): Promise<void> {
    return this.#tokens.disconnect(agent.tokenId);
  }

  dispose(): void {
    this.#unsubscribe();
    for (const event of kRoomEvents) {
      this.#chat.room.off(event, this.#changed);
    }
    this.#chat.dispose();
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  readonly #changed = (): void => {
    this.dispatchEvent(new Event(AGENT_CHAT_CHANGE));
  };

  readonly #onSaid = (
    entry: AgentChatEntry
  ): void => {
    if (!this.#visible && isAgentProfile(entry)) {
      this.#notifier.notify({
        tone: "info",
        source: AGENT_CHAT_NOTIFICATION_SOURCE,
        title: entry.username,
        message: entry.text
      });
    }
    this.#changed();
  };
}

function chatAgent(
  peer: Peer
): ChatAgent | null {
  const profile = parseAgentProfile(peer.profile);
  if (profile === null) {
    return null;
  }

  const activity = parseAgentChatActivity(peer.presence);

  return {
    clientId: peer.clientId,
    tokenId: profile.peerId,
    ownerId: profile.ownerId,
    username: profile.username,
    color: peerProfileColor(peer.clientId, peer.profile),
    activity: activity === null ? null : {
      label: formatPeerActivity(activity),
      assetId: activity.assetId
    }
  };
}
