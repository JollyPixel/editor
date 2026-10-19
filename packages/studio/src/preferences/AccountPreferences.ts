// Import Third-party Dependencies
import * as z from "zod";
import {
  Preferences,
  type PreferenceChange,
  type PreferenceOverrides
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import type { PreferencesClient } from "./PreferencesClient.ts";
import { preferenceOverridesSchema } from "./routes.ts";

// CONSTANTS
export const PREFERENCES_CHANNEL = "jolly-pixel:preferences";
const kBroadcastSchema = z.object({
  accountId: z.string(),
  scope: z.string(),
  overrides: preferenceOverridesSchema
});

export type AccountPreferencesClient = Pick<
  PreferencesClient,
  "list" | "replace"
>;

export interface AccountPreferencesOptions {
  accountId: string;
  client: AccountPreferencesClient;
  /**
   * Keeps the other tabs of this browser in sync. `null` disables it.
   * @default new BroadcastChannel(PREFERENCES_CHANNEL)
   */
  channel?: BroadcastChannel | null;
}

export class AccountPreferences implements Disposable {
  static async load(
    options: AccountPreferencesOptions
  ): Promise<AccountPreferences> {
    return new AccountPreferences(await options.client.list(), options);
  }

  readonly preferences: Preferences;

  #accountId: string;
  #client: AccountPreferencesClient;
  #channel: BroadcastChannel | null;
  #pending = new Map<string, PreferenceOverrides>();
  #sending = new Set<string>();
  #errorListeners = new Set<(message: string) => void>();

  constructor(
    overrides: Iterable<readonly [string, PreferenceOverrides]>,
    options: AccountPreferencesOptions
  ) {
    this.#accountId = options.accountId;
    this.#client = options.client;
    this.#channel = options.channel === undefined ?
      new BroadcastChannel(PREFERENCES_CHANNEL) :
      options.channel;
    this.#channel?.addEventListener("message", this.#onMessage);
    this.preferences = new Preferences({
      overrides,
      write: (change) => this.#write(change)
    });
  }

  onError(
    listener: (message: string) => void
  ): () => void {
    this.#errorListeners.add(listener);

    return () => {
      this.#errorListeners.delete(listener);
    };
  }

  [Symbol.dispose](): void {
    this.#channel?.removeEventListener("message", this.#onMessage);
    this.#channel?.close();
  }

  #write(
    change: PreferenceChange
  ): void {
    this.#channel?.postMessage({
      accountId: this.#accountId,
      scope: change.scope,
      overrides: change.overrides
    });
    this.#pending.set(change.scope, change.overrides);
    void this.#send(change.scope);
  }

  async #send(
    scope: string
  ): Promise<void> {
    if (this.#sending.has(scope)) {
      return;
    }

    this.#sending.add(scope);
    try {
      let overrides = this.#pending.get(scope);
      while (overrides !== undefined) {
        this.#pending.delete(scope);
        await this.#replace(scope, overrides);
        overrides = this.#pending.get(scope);
      }
    }
    finally {
      this.#sending.delete(scope);
    }
  }

  async #replace(
    scope: string,
    overrides: PreferenceOverrides
  ): Promise<void> {
    try {
      await this.#client.replace(scope, overrides);
    }
    catch (error) {
      const message = `Preferences not saved: ${error instanceof Error ? error.message : String(error)}`;
      for (const listener of this.#errorListeners) {
        listener(message);
      }
    }
  }

  readonly #onMessage = (
    event: MessageEvent
  ): void => {
    const message = kBroadcastSchema.safeParse(event.data);
    if (message.success && message.data.accountId === this.#accountId) {
      this.preferences.receive(message.data.scope, message.data.overrides);
    }
  };
}
