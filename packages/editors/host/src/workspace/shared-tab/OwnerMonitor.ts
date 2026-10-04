// Import Internal Dependencies
import {
  DISCOVERY_INTERVAL_MS,
  DISCOVERY_TIMEOUT_MS,
  type OwnerMessage,
  type OwnerPort
} from "./protocol.ts";

export interface OwnerMonitorOptions {
  channel: OwnerPort;
  tab: string;
  lock: string;
  onLost: () => void;
}

export class OwnerMonitor {
  readonly #channel: OwnerPort;
  readonly #tab: string;
  readonly #lock: string;
  readonly #onLost: () => void;
  readonly #watch = new AbortController();
  #owner: string | undefined;
  #stopped = false;
  #discovered: (() => void) | null = null;

  constructor(
    options: OwnerMonitorOptions
  ) {
    this.#channel = options.channel;
    this.#tab = options.tab;
    this.#lock = options.lock;
    this.#onLost = options.onLost;
  }

  get owner(): string | undefined {
    return this.#owner;
  }

  handle(
    message: OwnerMessage
  ): void {
    if (message.type === "owner") {
      this.#owner = message.owner;
      this.#discovered?.();
    }
  }

  async discover(): Promise<string> {
    const started = Date.now();
    while (this.#owner === undefined) {
      this.#channel.postMessage({
        type: "hello",
        tab: this.#tab
      } satisfies OwnerMessage);
      const interval = Promise.withResolvers<void>();
      const timer = setTimeout(interval.resolve, DISCOVERY_INTERVAL_MS);
      this.#discovered = interval.resolve;
      await interval.promise;
      clearTimeout(timer);
      this.#discovered = null;
      if (
        this.#owner === undefined &&
        Date.now() - started > DISCOVERY_TIMEOUT_MS
      ) {
        throw new Error("The shared workspace owner did not respond.");
      }
    }
    this.#watchLock();

    return this.#owner;
  }

  stop(): void {
    this.#stopped = true;
    this.#watch.abort();
  }

  #watchLock(): void {
    if (this.#stopped) {
      return;
    }

    globalThis.navigator.locks.request(
      this.#lock,
      { signal: this.#watch.signal },
      () => this.#lose()
    ).catch(() => undefined);
  }

  #lose(): void {
    if (this.#stopped) {
      return;
    }

    this.stop();
    this.#onLost();
  }
}
