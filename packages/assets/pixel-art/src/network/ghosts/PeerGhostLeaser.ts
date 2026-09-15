// CONSTANTS
const kDefaultTimeoutMs = 1500;

export interface PeerGhostLeaserOptions {
  onExpire: (clientId: string) => void;
  timeoutMs?: number;
}

export class PeerGhostLeaser {
  #onExpire: (clientId: string) => void;
  #timeoutMs: number;
  #timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    options: PeerGhostLeaserOptions
  ) {
    this.#onExpire = options.onExpire;
    this.#timeoutMs = options.timeoutMs ?? kDefaultTimeoutMs;
  }

  renew(
    clientId: string
  ): void {
    this.cancel(clientId);
    this.#timers.set(
      clientId,
      setTimeout(() => {
        this.#timers.delete(clientId);
        this.#onExpire(clientId);
      }, this.#timeoutMs)
    );
  }

  cancel(
    clientId: string
  ): void {
    clearTimeout(
      this.#timers.get(clientId)
    );
    this.#timers.delete(clientId);
  }

  clear(): void {
    for (const timer of this.#timers.values()) {
      clearTimeout(timer);
    }
    this.#timers.clear();
  }
}
