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
  AGENT_BRIDGE_PRESENCE_KEY,
  AGENT_CHAT_ANSWER,
  AGENT_CHAT_ANSWERED,
  AGENT_CHAT_CANCEL,
  AGENT_CHAT_CANCELLED,
  AGENT_CHAT_HISTORY,
  AGENT_CHAT_ROOM,
  AGENT_CHAT_SAID,
  AGENT_CHAT_SAY,
  agentBridgeStateSchema,
  appendChatEntry,
  type AgentBridgeControl,
  type AgentBridgeState,
  type AgentChatActivity,
  type AgentChatCommand,
  type AgentChatEntry,
  type AgentChatMessage,
  type AgentChatSaid
} from "./chat.ts";
import { agentChatCommandProtocol } from "./chat.schema.ts";
import { AgentChatRefusedError } from "./errors/AgentChatRefusedError.ts";
import {
  AgentChatUnavailableError
} from "./errors/AgentChatUnavailableError.ts";

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

export interface AgentChatConnectOptions {
  timeoutMs: number;
  signal?: AbortSignal;
}

export type AgentChatListener = (entry: AgentChatEntry) => void;
export type AgentBridgeControlListener = (
  control: AgentBridgeControl
) => void;

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

  static async connect(
    rooms: AgentChatRoomSource,
    options: AgentChatConnectOptions
  ): Promise<AgentChatClient> {
    const chat = AgentChatClient.join(rooms);
    try {
      await readyWithin(chat.ready, options);
    }
    catch (error) {
      chat.dispose();

      throw error;
    }

    return chat;
  }

  readonly room: AgentChatRoom;

  #messages: AgentChatEntry[] = [];
  #listeners = new Set<AgentChatListener>();
  #controlListeners = new Set<AgentBridgeControlListener>();
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

  subscribeControls(
    listener: AgentBridgeControlListener
  ): () => void {
    this.#controlListeners.add(listener);

    return () => this.#controlListeners.delete(listener);
  }

  async say(
    text: string,
    options: AgentChatSayOptions = {}
  ): Promise<AgentChatEntry> {
    this.#send({
      type: AGENT_CHAT_SAY,
      text,
      ...(options.assetId === undefined ? {} : { assetId: options.assetId })
    });
    const pending = Promise.withResolvers<AgentChatEntry>();
    this.#pending.push(pending);

    return pending.promise;
  }

  answer(
    bridgeClientId: string,
    requestId: string,
    optionId: string
  ): void {
    this.#send({
      type: AGENT_CHAT_ANSWER,
      bridgeClientId,
      requestId,
      optionId
    });
  }

  cancel(
    bridgeClientId: string
  ): void {
    this.#send({
      type: AGENT_CHAT_CANCEL,
      bridgeClientId
    });
  }

  publishBridge(
    state: AgentBridgeState | null
  ): void {
    if (state !== null) {
      refuseInvalid(agentBridgeStateSchema.safeParse(state));
    }
    this.room.updatePresence({
      [AGENT_BRIDGE_PRESENCE_KEY]: state
    });
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
    this.#controlListeners.clear();
    this.#rejectAll(new AgentChatRefusedError("the chat was closed"));
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  #send(
    command: AgentChatCommand
  ): void {
    refuseInvalid(agentChatCommandProtocol.schema.safeParse(command));
    this.room.send(command);
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
    switch (message.type) {
      case AGENT_CHAT_HISTORY:
        this.#messages = [...message.messages];
        this.#ready.resolve();
        break;
      case AGENT_CHAT_SAID:
        this.#onSaid(message);
        break;
      case AGENT_CHAT_ANSWERED:
      case AGENT_CHAT_CANCELLED:
        for (const listener of this.#controlListeners) {
          listener(message);
        }
        break;
      default:
        message satisfies never;
    }
  };

  #onSaid(
    said: AgentChatSaid
  ): void {
    const { type: _type, ...entry } = said;
    appendChatEntry(this.#messages, entry);
    if (entry.clientId === this.room.clientId) {
      this.#pending.shift()?.resolve(entry);
    }
    for (const listener of this.#listeners) {
      listener(entry);
    }
  }

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

function refuseInvalid(
  parsed: z.ZodSafeParseResult<unknown>
): void {
  if (!parsed.success) {
    throw new AgentChatRefusedError(z.prettifyError(parsed.error));
  }
}

async function readyWithin(
  ready: Promise<void>,
  options: AgentChatConnectOptions
): Promise<void> {
  const { timeoutMs, signal } = options;
  signal?.throwIfAborted();

  const failed = Promise.withResolvers<never>();
  const timer = setTimeout(
    () => failed.reject(new AgentChatUnavailableError()),
    timeoutMs
  );
  function onAbort(): void {
    failed.reject(signal?.reason);
  }
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    await Promise.race([
      ready,
      failed.promise
    ]);
  }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
