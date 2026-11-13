// Import Third-party Dependencies
import {
  Extension,
  parsePeerProfile,
  type ClientHandle,
  type MessageProtocols,
  type RoomContext,
  type RoomPeer
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  AGENT_CHAT_HISTORY,
  AGENT_CHAT_ROOM,
  AGENT_CHAT_SAID,
  appendChatEntry,
  type AgentChatCommand,
  type AgentChatEntry,
  type AgentChatMessage
} from "../../golem/chat.ts";
import { agentChatProtocols } from "../../golem/chat.schema.ts";

export class AgentChatExtension extends Extension<AgentChatCommand> {
  readonly id = AGENT_CHAT_ROOM;
  readonly name = AGENT_CHAT_ROOM;
  readonly protocols: MessageProtocols = agentChatProtocols;

  #history: AgentChatEntry[] = [];
  #nextId = 1;

  override onClientConnect(
    _client: ClientHandle,
    peer: RoomPeer,
    context: RoomContext
  ): void {
    context.room.sendTo(peer.clientId, {
      type: AGENT_CHAT_HISTORY,
      messages: [...this.#history]
    } satisfies AgentChatMessage);
  }

  override onMessage(
    clientId: string,
    command: AgentChatCommand,
    context: RoomContext
  ): void {
    const author = parsePeerProfile(context.identity.profile);
    const entry: AgentChatEntry = {
      id: String(this.#nextId++),
      clientId,
      ...(author.peerId === undefined ? {} : { peerId: author.peerId }),
      username: author.username,
      ...(author.via === undefined ? {} : { via: author.via }),
      text: command.text,
      ...(command.assetId === undefined ? {} : { assetId: command.assetId }),
      at: Date.now()
    };
    appendChatEntry(this.#history, entry);
    context.room.broadcast({
      type: AGENT_CHAT_SAID,
      ...entry
    } satisfies AgentChatMessage);
  }

  override dispose(): void {
    this.#history = [];
  }
}
