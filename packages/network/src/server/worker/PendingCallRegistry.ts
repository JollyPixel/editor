// Import Third-party Dependencies
import hyperid from "hyperid";

export interface PendingCallEntry<TResult> {
  resolve: (value: TResult) => void;
  reject: (error: Error) => void;
}

export interface PendingCall<TResult> {
  id: string;
  promise: Promise<TResult>;
}

export interface PendingCallOptions {
  timeoutMs?: number;
  timeoutMessage?: string;
}

// Distinguishes an expired timeout from an explicit error reply.
export class PendingCallTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PendingCallTimeoutError";
  }
}

export class PendingCallRegistry<TResult = unknown> {
  #generateId = hyperid();
  #pending = new Map<string, PendingCallEntry<TResult>>();

  create(
    options: PendingCallOptions = {}
  ): PendingCall<TResult> {
    const id = this.#generateId();
    const {
      promise, resolve, reject
    } = Promise.withResolvers<TResult>();

    let timer: NodeJS.Timeout | undefined;
    if (options.timeoutMs !== undefined) {
      const timeoutMessage = options.timeoutMessage ??
        `pending call "${id}" timed out after ${options.timeoutMs}ms`;
      timer = setTimeout(
        () => this.reject(id, new PendingCallTimeoutError(timeoutMessage)),
        options.timeoutMs
      );
    }

    this.#pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      }
    });

    return { id, promise };
  }

  resolve(
    id: string,
    value: TResult
  ): boolean {
    const entry = this.#pending.get(id);
    if (!entry) {
      return false;
    }
    this.#pending.delete(id);
    entry.resolve(value);

    return true;
  }

  reject(
    id: string,
    error: Error
  ): boolean {
    const entry = this.#pending.get(id);
    if (!entry) {
      return false;
    }
    this.#pending.delete(id);
    entry.reject(error);

    return true;
  }

  rejectAll(
    error: Error
  ): void {
    for (const entry of this.#pending.values()) {
      entry.reject(error);
    }
    this.#pending.clear();
  }
}
