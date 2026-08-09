// CONSTANTS
const kDefaultTimeoutMs = 1500;

export interface PeerGhostLeaserOptions {
  /** Called when a peer stops renewing its ghost lease. */
  onExpire: (clientId: string) => void;
  /**
   * Maximum time a ghost lease can remain idle.
   * @default 1500
   */
  timeoutMs?: number;
}

/**
 * Tracks inactivity leases for ephemeral peer ghost state.
 */
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
