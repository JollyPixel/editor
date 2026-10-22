// Import Node.js Dependencies
import { randomUUID } from "node:crypto";
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import type { PreferenceOverrides } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import {
  AccountPreferences,
  type AccountPreferencesClient
} from "../../src/preferences/AccountPreferences.ts";
import { STUDIO_PREFERENCES } from "../../shared/studioScope.ts";

class RecordingClient implements AccountPreferencesClient {
  readonly sent: PreferenceOverrides[] = [];
  #replies: PromiseWithResolvers<void>[] = [];

  async list(): Promise<Map<string, PreferenceOverrides>> {
    return new Map();
  }

  async replace(
    _scope: string,
    overrides: PreferenceOverrides
  ): Promise<PreferenceOverrides> {
    this.sent.push(overrides);
    const reply = Promise.withResolvers<void>();
    this.#replies.push(reply);
    await reply.promise;

    return overrides;
  }

  answer(
    error?: Error
  ): void {
    const reply = this.#replies.shift();
    if (error === undefined) {
      reply?.resolve();
    }
    else {
      reply?.reject(error);
    }
  }
}

function open(
  client: AccountPreferencesClient,
  channel: string | null = null
): AccountPreferences {
  return new AccountPreferences([], {
    accountId: "alice",
    client,
    channel: channel === null ? null : new BroadcastChannel(channel)
  });
}

describe("AccountPreferences", () => {
  test("sends only the latest overrides once the pending write answers", async() => {
    const client = new RecordingClient();
    using account = open(client);

    account.preferences.assign(STUDIO_PREFERENCES, "theme", "dark");
    account.preferences.assign(STUDIO_PREFERENCES, "theme", "light");
    account.preferences.assign(STUDIO_PREFERENCES, "density", "compact");
    client.answer();
    await setImmediate();
    client.answer();

    assert.deepEqual(client.sent, [
      { theme: "dark" },
      { theme: "light", density: "compact" }
    ]);
  });

  test("applies another tab's change without sending it again", async() => {
    const channel = randomUUID();
    const writer = new RecordingClient();
    const reader = new RecordingClient();
    using first = open(writer, channel);
    using second = open(reader, channel);
    const received = new Promise((resolve) => {
      second.preferences.watch(STUDIO_PREFERENCES, resolve);
    });

    first.preferences.assign(STUDIO_PREFERENCES, "theme", "dark");
    await received;

    assert.equal(second.preferences.values(STUDIO_PREFERENCES).theme, "dark");
    assert.deepEqual(reader.sent, []);
  });

  test("reports a write the server refused", async() => {
    const client = new RecordingClient();
    using account = open(client);
    const failed = new Promise<string>((resolve) => {
      account.onError(resolve);
    });

    account.preferences.assign(STUDIO_PREFERENCES, "theme", "dark");
    client.answer(new Error("no valid session"));

    assert.equal(await failed, "Preferences not saved: no valid session");
  });
});
