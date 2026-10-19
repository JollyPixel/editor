// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PreferencesClient } from "../../../../src/preferences/PreferencesClient.ts";
import { PREFERENCES_URL_PATH } from "../../../../src/preferences/routes.ts";
import {
  listenStudioApi,
  type StudioApiServer
} from "../../../helpers/studioApi.ts";

async function signedIn(
  server: StudioApiServer,
  username: string
): Promise<{ client: PreferencesClient; accountId: string; }> {
  const page = server.browser();
  const registration = await page.client.register(username, "correct horse");
  assert.ok(registration.status === "active");

  return {
    client: new PreferencesClient({
      url: new URL(`.${PREFERENCES_URL_PATH}`, server.url),
      fetch: page.fetch
    }),
    accountId: registration.account.id
  };
}

describe("preferencesRoutes", () => {
  test("keeps each account's overrides apart", async() => {
    await using server = await listenStudioApi();
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
    await using server = await listenStudioApi();
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

  test("drops stored fields the descriptors no longer declare", async() => {
    await using server = await listenStudioApi();
    const { client, accountId } = await signedIn(server, "Alice");
    server.accounts.replacePreferences(accountId, "studio", {
      theme: "light",
      retired: true
    });
    server.accounts.replacePreferences(accountId, "retired", {
      speed: 2
    });

    assert.deepEqual(await client.list(), new Map([
      ["studio", { theme: "light" }]
    ]));
  });

  test("answers 401 without a session", async() => {
    await using server = await listenStudioApi();
    const client = new PreferencesClient({
      url: new URL(`.${PREFERENCES_URL_PATH}`, server.url)
    });

    await assert.rejects(client.list(), {
      name: "ApiRequestError",
      status: 401
    });
  });
});
