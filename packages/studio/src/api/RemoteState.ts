// Import Third-party Dependencies
import type { ApiFailureCode } from "@jolly-pixel/server";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { ApiRequestError } from "./errors/ApiRequestError.ts";

// CONSTANTS
export const REMOTE_STATE_CHANGE = "change";

export class RemoteState extends EventTarget {
  #pending = 0;
  #latest = 0;
  #error: string | null = null;
  #errorCode: ApiFailureCode | null = null;

  get loading(): boolean {
    return this.#pending > 0;
  }

  get error(): string | null {
    return this.#error;
  }

  get errorCode(): ApiFailureCode | null {
    return this.#errorCode;
  }

  protected run<TValue>(
    request: () => Promise<TValue>,
    settle: (value: TValue) => void
  ): Promise<TValue | null> {
    return this.#track(request, settle, () => true);
  }

  protected latest<TValue>(
    request: () => Promise<TValue>,
    settle: (value: TValue) => void
  ): Promise<TValue | null> {
    const id = ++this.#latest;

    return this.#track(request, settle, () => id === this.#latest);
  }

  async #track<TValue>(
    request: () => Promise<TValue>,
    settle: (value: TValue) => void,
    current: () => boolean
  ): Promise<TValue | null> {
    this.#pending++;
    this.#changed();
    try {
      const value = await request();
      if (!current()) {
        return null;
      }
      settle(value);
      this.#error = null;
      this.#errorCode = null;

      return value;
    }
    catch (error) {
      if (current()) {
        this.#error = errorMessage(error);
        this.#errorCode = error instanceof ApiRequestError ? error.code : null;
      }

      return null;
    }
    finally {
      this.#pending--;
      this.#changed();
    }
  }

  #changed(): void {
    this.dispatchEvent(new Event(REMOTE_STATE_CHANGE));
  }
}
