// CONSTANTS
const kDefaultCapacity = 10_000;

interface FailureWindow {
  count: number;
  since: number;
}

export interface FailedAttemptsOptions {
  limit: number;
  windowMs: number;
  capacity?: number;
}

export class FailedAttempts {
  #limit: number;
  #windowMs: number;
  #capacity: number;
  #windows = new Map<string, FailureWindow>();

  constructor(
    options: FailedAttemptsOptions
  ) {
    this.#limit = options.limit;
    this.#windowMs = options.windowMs;
    this.#capacity = options.capacity ?? kDefaultCapacity;
  }

  blocks(
    address: string
  ): boolean {
    const window = this.#current(address);

    return window !== undefined && window.count >= this.#limit;
  }

  record(
    address: string
  ): void {
    const window = this.#current(address);
    if (window !== undefined) {
      window.count++;

      return;
    }

    if (this.#windows.size >= this.#capacity) {
      const oldest = this.#windows.keys().next().value;
      if (oldest !== undefined) {
        this.#windows.delete(oldest);
      }
    }
    this.#windows.set(address, {
      count: 1,
      since: Date.now()
    });
  }

  forgive(
    address: string
  ): void {
    this.#windows.delete(address);
  }

  #current(
    address: string
  ): FailureWindow | undefined {
    const window = this.#windows.get(address);
    if (
      window !== undefined &&
      Date.now() - window.since >= this.#windowMs
    ) {
      this.#windows.delete(address);

      return undefined;
    }

    return window;
  }
}
