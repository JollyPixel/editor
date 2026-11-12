// Import Third-party Dependencies
import { isAgentProfile } from "@jolly-pixel/accounts";
import type { AgentChatEntry } from "@jolly-pixel/server";
import type {
  AgentChatClient,
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

  dispose(): void {
    this.#unsubscribe();
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

    this.#unread.push(entry);
    for (const arrive of this.#arrivals) {
      arrive();
    }
  };
}
