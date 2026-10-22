// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PreferencesClient } from "../../../../src/preferences/PreferencesClient.ts";
import { PREFERENCES_URL_PATH } from "../../../../shared/api/preferences.ts";
import {
  serveBackend,
  type ServedBackend
} from "../../../helpers/studioBackend.ts";

async function signedIn(
  server: ServedBackend,
  username: string
): Promise<{ client: PreferencesClient; }> {
  const page = server.browser();
  const registration = await page.client.register(username, "correct horse");
  assert.ok(registration.status === "active");

  return {
    client: new PreferencesClient({
      url: new URL(`.${PREFERENCES_URL_PATH}`, server.url),
      fetch: page.fetch
    })
  };
}

describe("preferencesRoutes", () => {
  test("keeps each account's overrides apart", async() => {
    await using server = await serveBackend();
    const alice = await signedIn(server, "Alice");
    const bob = await signedIn(server, "Bob");

    const stored = await alice.client.replace("studio", {
      theme: "dark",
      density: "default"
    });

    assert.deepEqual(stored, { theme: "dark" });
    assert.deepEqual(await alice.client.list(), new Map([
      ["studio", { theme: "dark" }]
    ]));
    assert.deepEqual(await bob.client.list(), new Map());
  });

  test("refuses unknown scopes and values the descriptors refuse", async() => {
    await using server = await serveBackend();
    const { client } = await signedIn(server, "Alice");

    await assert.rejects(
      client.replace("studio", { theme: "sepia" }),
      { name: "ApiRequestError", status: 400 }
    );
    await assert.rejects(
      client.replace("studio", { retired: true }),
      { name: "ApiRequestError", status: 400 }
    );
    await assert.rejects(
      client.replace("missing", {}),
      { name: "ApiRequestError", status: 404 }
    );
  });

  test("answers 401 without a session", async() => {
    await using server = await serveBackend();
    const client = new PreferencesClient({
      url: new URL(`.${PREFERENCES_URL_PATH}`, server.url)
    });

    await assert.rejects(client.list(), {
      name: "ApiRequestError",
      status: 401
    });
  });
});
