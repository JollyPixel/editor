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
  AGENT_CHAT_ANSWER,
  AGENT_CHAT_ANSWERED,
  AGENT_CHAT_CANCEL,
  AGENT_CHAT_CANCELLED,
  AGENT_CHAT_HISTORY,
  AGENT_CHAT_ROOM,
  AGENT_CHAT_SAID,
  AGENT_CHAT_SAY,
  appendChatEntry,
  type AgentChatCommand,
  type AgentChatEntry,
  type AgentChatMessage
} from "../chat.ts";
import { agentChatProtocols } from "../chat.schema.ts";

type ChatCommand<TType extends AgentChatCommand["type"]> = Extract<
  AgentChatCommand,
  { type: TType; }
>;

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
    switch (command.type) {
      case AGENT_CHAT_SAY:
        this.#say(clientId, command, context);
        break;
      case AGENT_CHAT_ANSWER:
        this.#answer(clientId, command, context);
        break;
      case AGENT_CHAT_CANCEL:
        this.#cancel(clientId, command, context);
        break;
      default:
        command satisfies never;
    }
  }

  override dispose(): void {
    this.#history = [];
  }

  #say(
    clientId: string,
    command: ChatCommand<typeof AGENT_CHAT_SAY>,
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

  #answer(
    clientId: string,
    command: ChatCommand<typeof AGENT_CHAT_ANSWER>,
    context: RoomContext
  ): void {
    context.room.sendTo(command.bridgeClientId, {
      type: AGENT_CHAT_ANSWERED,
      ...controlAuthor(clientId, context),
      requestId: command.requestId,
      optionId: command.optionId
    } satisfies AgentChatMessage);
  }

  #cancel(
    clientId: string,
    command: ChatCommand<typeof AGENT_CHAT_CANCEL>,
    context: RoomContext
  ): void {
    context.room.sendTo(command.bridgeClientId, {
      type: AGENT_CHAT_CANCELLED,
      ...controlAuthor(clientId, context)
    } satisfies AgentChatMessage);
  }
}

function controlAuthor(
  clientId: string,
  context: RoomContext
): { clientId: string; peerId?: string; } {
  const { peerId } = parsePeerProfile(context.identity.profile);

  return peerId === undefined ? { clientId } : { clientId, peerId };
}
