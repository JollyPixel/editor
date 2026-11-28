// Import Third-party Dependencies
import {
  isAgentProfile,
  parseAgentProfile
} from "@jolly-pixel/accounts";
import type { AgentChatEntry } from "@jolly-pixel/server";
import type {
  AgentChatClient,
  AgentChatListener,
  AgentChatSayOptions
} from "@jolly-pixel/server/client";

// CONSTANTS
export const CHAT_NEXT_TIMEOUT_MS = 30_000;

export interface ChatNextOptions {
  /**
   * @default CHAT_NEXT_TIMEOUT_MS
   */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class ChatChannel implements Disposable {
  #chat: AgentChatClient;
  #unread: AgentChatEntry[] = [];
  #arrivals = new Set<() => void>();
  #ownerFollowers = new Set<AgentChatListener>();
  #unsubscribe: () => void;

  constructor(
    chat: AgentChatClient
  ) {
    this.#chat = chat;
    this.#unsubscribe = chat.subscribe(this.#onSaid);
  }

  get ready(): Promise<void> {
    return this.#chat.ready;
  }

  get unread(): number {
    return this.#unread.length;
  }

  say(
    text: string,
    options?: AgentChatSayOptions
  ): Promise<AgentChatEntry> {
    return this.#chat.say(text, options);
  }

  async next(
    options: ChatNextOptions = {}
  ): Promise<AgentChatEntry[]> {
    if (this.#unread.length === 0) {
      await this.#arrival(options);
    }

    return this.#unread.splice(0);
  }

  followOwner(
    listener: AgentChatListener
  ): () => void {
    this.#ownerFollowers.add(listener);

    return () => this.#ownerFollowers.delete(listener);
  }

  dispose(): void {
    this.#unsubscribe();
    this.#ownerFollowers.clear();
    for (const arrive of this.#arrivals) {
      arrive();
    }
    this.#chat.dispose();
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  async #arrival(
    options: ChatNextOptions
  ): Promise<void> {
    const {
      timeoutMs = CHAT_NEXT_TIMEOUT_MS,
      signal
    } = options;
    signal?.throwIfAborted();

    const {
      promise,
      resolve,
      reject
    } = Promise.withResolvers<void>();
    const timer = setTimeout(resolve, timeoutMs);
    function abort(): void {
      reject(signal?.reason);
    }
    signal?.addEventListener("abort", abort, { once: true });
    this.#arrivals.add(resolve);

    return promise.finally(() => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      this.#arrivals.delete(resolve);
    });
  }

  readonly #onSaid = (
    entry: AgentChatEntry
  ): void => {
    if (
      isAgentProfile(entry) ||
      entry.clientId === this.#chat.room.clientId
    ) {
      return;
    }
    if (this.#ownerFollowers.size > 0 && this.#fromOwner(entry)) {
      for (const follow of this.#ownerFollowers) {
        follow(entry);
      }

      return;
    }

    this.#unread.push(entry);
    for (const arrive of this.#arrivals) {
      arrive();
    }
  };

  #fromOwner(
    entry: AgentChatEntry
  ): boolean {
    const agent = parseAgentProfile(this.#chat.room.profile);

    return agent !== null && entry.peerId === agent.ownerId;
  }
}
