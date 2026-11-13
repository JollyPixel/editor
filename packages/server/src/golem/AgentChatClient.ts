// Import Third-party Dependencies
import {
  JOIN_EVENT,
  MESSAGE_EVENT,
  PEER_ACTIVITY_KEY
} from "@jolly-pixel/network";
import type {
  Room,
  RoomRejectionEvent
} from "@jolly-pixel/network/client";
import * as z from "zod";

// Import Internal Dependencies
import {
  AGENT_CHAT_HISTORY,
  AGENT_CHAT_ROOM,
  AGENT_CHAT_SAY,
  appendChatEntry,
  type AgentChatActivity,
  type AgentChatCommand,
  type AgentChatEntry,
  type AgentChatMessage
} from "./chat.ts";
import { agentChatCommandProtocol } from "./chat.schema.ts";
import { AgentChatRefusedError } from "./errors/AgentChatRefusedError.ts";

// CONSTANTS
const kRefusedEvents = new Set([
  AGENT_CHAT_SAY,
  MESSAGE_EVENT
]);

export type AgentChatRoom = Room<AgentChatCommand, AgentChatMessage>;

export interface AgentChatRoomSource {
  room(
    name: string
  ): AgentChatRoom;
}

export interface AgentChatSayOptions {
  assetId?: string;
}

export type AgentChatListener = (entry: AgentChatEntry) => void;

interface PendingSay {
  resolve: (entry: AgentChatEntry) => void;
  reject: (error: Error) => void;
}

export class AgentChatClient implements Disposable {
  static join(
    rooms: AgentChatRoomSource
  ): AgentChatClient {
    return new AgentChatClient(rooms.room(AGENT_CHAT_ROOM));
  }

  readonly room: AgentChatRoom;

  #messages: AgentChatEntry[] = [];
  #listeners = new Set<AgentChatListener>();
  #pending: PendingSay[] = [];
  #ready = Promise.withResolvers<void>();

  constructor(
    room: AgentChatRoom
  ) {
    this.room = room;
    this.#ready.promise.catch(() => undefined);
    room.on("message", this.#onMessage);
    room.on("denied", this.#onRefused);
    room.on("error", this.#onRefused);
    room.join();
  }

  get ready(): Promise<void> {
    return this.#ready.promise;
  }

  get messages(): readonly AgentChatEntry[] {
    return this.#messages;
  }

  subscribe(
    listener: AgentChatListener
  ): () => void {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  }

  say(
    text: string,
    options: AgentChatSayOptions = {}
  ): Promise<AgentChatEntry> {
    const command: AgentChatCommand = {
      type: AGENT_CHAT_SAY,
      text,
      ...(options.assetId === undefined ? {} : { assetId: options.assetId })
    };
    const parsed = agentChatCommandProtocol.schema.safeParse(command);
    if (!parsed.success) {
      return Promise.reject(
        new AgentChatRefusedError(z.prettifyError(parsed.error))
      );
    }

    const pending = Promise.withResolvers<AgentChatEntry>();
    this.#pending.push(pending);
    this.room.send(command);

    return pending.promise;
  }

  publishActivity(
    activity: AgentChatActivity | null
  ): void {
    this.room.updatePresence({
      [PEER_ACTIVITY_KEY]: activity
    });
  }

  dispose(): void {
    this.room.off("message", this.#onMessage);
    this.room.off("denied", this.#onRefused);
    this.room.off("error", this.#onRefused);
    this.room.leave();
    this.#listeners.clear();
    this.#rejectAll(new AgentChatRefusedError("the chat was closed"));
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  #rejectAll(
    error: Error
  ): void {
    for (const pending of this.#pending.splice(0)) {
      pending.reject(error);
    }
    this.#ready.reject(error);
  }

  readonly #onMessage = (
    message: AgentChatMessage
  ): void => {
    if (message.type === AGENT_CHAT_HISTORY) {
      this.#messages = [...message.messages];
      this.#ready.resolve();

      return;
    }

    const { type: _type, ...entry } = message;
    appendChatEntry(this.#messages, entry);
    if (entry.clientId === this.room.clientId) {
      this.#pending.shift()?.resolve(entry);
    }
    for (const listener of this.#listeners) {
      listener(entry);
    }
  };

  readonly #onRefused = (
    event: RoomRejectionEvent
  ): void => {
    const error = new AgentChatRefusedError(event.reason);
    if (event.event === JOIN_EVENT) {
      this.#rejectAll(error);
    }
    else if (kRefusedEvents.has(event.event)) {
      this.#pending.shift()?.reject(error);
    }
  };
}
