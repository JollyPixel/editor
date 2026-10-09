// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createAccounts,
  createStore,
  storeWith
} from "../../helpers/accounts.ts";
import { listenAccounts } from "../../helpers/accountsServer.ts";
import type { AccountsRequestError } from "#src/index.ts";

function postCredentials(
  url: URL,
  username: string,
  headers: Record<string, string> = {}
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify({
      username,
      password: "w".repeat(43)
    })
  });
}

describe("AccountsApi throttle", () => {
  test("throttles a username after too many failed logins", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store, {
      throttle: {
        attempts: 2
      }
    }));
    const { client } = server.browser();
    await client.register("Alice", "correct horse");

    for (let attempt = 0; attempt < 2; attempt++) {
      await assert.rejects(client.login("Alice", "wrong horse"));
    }

    await assert.rejects(
      client.login("Alice", "correct horse"),
      (error: AccountsRequestError) => error.status === 429 &&
        error.code === "throttled"
    );
  });

  test("counts parallel logins before checking any password", async() => {
    using store = storeWith("Alice");
    await using server = await listenAccounts(createAccounts(store, {
      throttle: {
        attempts: 3
      }
    }));
    const url = new URL("login", server.url);

    const statuses = await Promise.all(
      Array.from({ length: 12 }, async() => (await postCredentials(url, "Alice")).status)
    );

    assert.equal(statuses.filter((status) => status === 401).length, 3);
    assert.equal(statuses.filter((status) => status === 429).length, 9);
  });

  test("throttles registrations from one address", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store, {
      throttle: {
        registrations: 2
      }
    }));

    await server.browser().client.register("Alice", "correct horse");
    await server.browser().client.register("Bob", "correct horse");
    await assert.rejects(
      server.browser().client.register("Carol", "correct horse"),
      (error: AccountsRequestError) => error.status === 429 &&
        error.code === "throttled"
    );
    assert.equal(store.size, 2);
  });

  test("keys the address throttle on the address the proxies forward", async() => {
    using store = storeWith("Alice", "Bob");
    await using server = await listenAccounts(createAccounts(store, {
      proxyHops: 1,
      throttle: {
        attempts: 1
      }
    }));
    const url = new URL("login", server.url);
    function from(
      address: string
    ): Record<string, string> {
      return {
        "x-forwarded-for": `203.0.113.9, ${address}`
      };
    }

    assert.equal((await postCredentials(url, "Alice", from("10.0.0.1"))).status, 401);
    assert.equal((await postCredentials(url, "Bob", from("10.0.0.1"))).status, 429);
    assert.equal((await postCredentials(url, "Bob", from("10.0.0.2"))).status, 401);
  });
});
