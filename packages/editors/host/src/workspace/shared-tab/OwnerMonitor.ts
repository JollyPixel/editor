// Import Internal Dependencies
import {
  DISCOVERY_INTERVAL_MS,
  DISCOVERY_TIMEOUT_MS,
  HEARTBEAT_MS,
  OWNER_LOSS_MS,
  type OwnerMessage,
  type OwnerPort
} from "./protocol.ts";

export interface OwnerMonitorOptions {
  channel: OwnerPort;
  tab: string;
  onLost: () => void;
}

export class OwnerMonitor {
  readonly #channel: OwnerPort;
  readonly #tab: string;
  readonly #onLost: () => void;
  #owner: string | undefined;
  #lastSeen = Date.now();
  #interval: ReturnType<typeof setInterval> | undefined;
  #stopped = false;

  constructor(
    options: OwnerMonitorOptions
  ) {
    this.#channel = options.channel;
    this.#tab = options.tab;
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
      this.#lastSeen = Date.now();
    }
    else if (
      message.type === "heartbeat" &&
      message.owner === this.#owner
    ) {
      this.#lastSeen = Date.now();
    }
    else if (
      message.type === "stopping" &&
      message.owner === this.#owner
    ) {
      this.#lose();
    }
  }

  async discover(): Promise<string> {
    const started = Date.now();
    while (this.#owner === undefined) {
      this.#channel.postMessage({
        type: "hello",
        tab: this.#tab
      } satisfies OwnerMessage);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, DISCOVERY_INTERVAL_MS);
      });
      if (Date.now() - started > DISCOVERY_TIMEOUT_MS) {
        throw new Error("The shared workspace owner did not respond.");
      }
    }
    this.#interval = setInterval(() => {
      if (Date.now() - this.#lastSeen > OWNER_LOSS_MS) {
        this.#lose();
      }
    }, HEARTBEAT_MS);

    return this.#owner;
  }

  stop(): void {
    this.#stopped = true;
    clearInterval(this.#interval);
  }

  #lose(): void {
    if (this.#stopped) {
      return;
    }

    this.stop();
    this.#onLost();
  }
}
