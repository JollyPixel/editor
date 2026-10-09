// Import Node.js Dependencies
import http from "node:http";
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import sharp from "sharp";

// Import Internal Dependencies
import {
  createAccounts,
  createStore,
  storeWith
} from "../helpers/accounts.ts";
import { listenAccounts } from "../helpers/accountsServer.ts";
import { solidPng } from "../helpers/avatar/images.ts";
import {
  AVATAR_MAX_BYTES,
  AccountsRequestError,
  InvalidPasswordError
} from "#src/index.ts";
import {
  AVATAR_SIZE_PX,
  DEFAULT_SESSION_COOKIE,
  SessionCookie
} from "#src/node.ts";

function postChunked(
  url: URL
): Promise<number | undefined> {
  const { promise, resolve, reject } = Promise.withResolvers<number | undefined>();
  const request = http.request(url, { method: "POST" }, (response) => {
    response.resume();
    resolve(response.statusCode);
  });
  request.on("error", reject);
  request.write("{}");
  request.end();

  return promise;
}

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

describe("createAccountsHandler", () => {
  test("keeps the session in an HttpOnly cookie, never in the body", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));
    const { fetch: browserFetch } = server.browser();

    const response = await browserFetch(new URL("register", server.url), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        username: "Alice",
        password: "p".repeat(43)
      })
    });

    assert.equal(response.status, 201);
    assert.deepEqual(Object.keys(await response.json()), ["account"]);
    assert.match(
      response.headers.get("set-cookie") ?? "",
      new RegExp(`^${DEFAULT_SESSION_COOKIE}=[\\w-]{43}; Max-Age=\\d+; Path=/; HttpOnly; SameSite=Strict$`)
    );
  });

  test("registers, resolves and closes a session", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));
    const { client, cookies } = server.browser();

    const account = await client.register("Alice", "correct horse");

    assert.equal(account.username, "Alice");
    assert.equal(account.role, "admin");
    assert.deepEqual(await client.me(), account);

    await client.logout();
    assert.equal(cookies.size, 0);
    assert.equal(await client.me(), null);
  });

  test("logs in with the password the account registered with", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));
    const registered = await server.browser().client.register("Alice", "correct horse");
    const { client } = server.browser();

    assert.deepEqual(await client.login("ALICE", "correct horse"), registered);
    assert.deepEqual(await client.me(), registered);
    await assert.rejects(
      client.login("Alice", "wrong horse"),
      (error: AccountsRequestError) => error.status === 401 &&
        error.code === "invalid-credentials"
    );
    await assert.rejects(
      client.login("Nobody", "correct horse"),
      (error: AccountsRequestError) => error.code === "invalid-credentials"
    );
  });

  test("reads the cookie it is configured with", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store, {
      cookie: new SessionCookie("project_session")
    }));
    const { client, cookies } = server.browser();

    await client.register("Alice", "correct horse");

    assert.deepEqual([...cookies.keys()], ["project_session"]);
    assert.notEqual(await client.me(), null);
  });

  test("refuses a request from another origin", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));
    const { client, fetch: browserFetch } = server.browser();
    await client.register("Alice", "correct horse");

    const response = await browserFetch(new URL("me", server.url), {
      headers: {
        origin: "http://evil.example"
      }
    });

    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "cross-origin");
  });

  test("refuses a taken username", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));
    await server.browser().client.register("Alice", "correct horse");

    await assert.rejects(
      server.browser().client.register("alice", "battery staple"),
      (error: AccountsRequestError) => error.status === 409 &&
        error.code === "username-taken"
    );
  });

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

  test("sets a Secure cookie from X-Forwarded-Proto only behind a proxy", async() => {
    async function cookieFrom(
      proxyHops: number
    ): Promise<string> {
      using store = createStore();
      await using server = await listenAccounts(createAccounts(store, {
        proxyHops
      }));
      const response = await fetch(new URL("register", server.url), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-proto": "https"
        },
        body: JSON.stringify({
          username: "Alice",
          password: "p".repeat(43)
        })
      });

      return response.headers.get("set-cookie") ?? "";
    }

    assert.doesNotMatch(await cookieFrom(0), /; Secure/);
    assert.match(await cookieFrom(1), /; Secure/);
  });

  test("refuses a password that is not a pre-hashed digest", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));

    const response = await fetch(new URL("register", server.url), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        username: "Alice",
        password: "correct horse"
      })
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "invalid-password");
    assert.equal(store.size, 0);
  });

  test("refuses a body that is too large or has no length", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));
    const url = new URL("login", server.url);

    const large = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ padding: "x".repeat(5_000) })
    });

    assert.equal(large.status, 413);
    assert.equal(await postChunked(url), 411);
  });

  test("refuses the wrong method and passes other routes on", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));

    assert.equal((await fetch(new URL("register", server.url))).status, 405);
    assert.equal((await fetch(new URL("unknown", server.url))).status, 404);
    assert.equal((await fetch(new URL("/elsewhere", server.url))).status, 404);
  });

  test("checks the password length before sending anything", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));

    await assert.rejects(
      server.browser().client.register("Alice", "short"),
      InvalidPasswordError
    );
    assert.equal(store.size, 0);
  });
});

describe("createAccountsHandler avatars", () => {
  test("replaces the avatar of the signed-in account and serves it", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));
    const { client } = server.browser();
    await client.register("Alice", "correct horse");

    const account = await client.replaceAvatar(
      new Blob([await solidPng(300, 200)], { type: "image/png" })
    );
    const response = await fetch(new URL(account.avatar ?? "", server.url));

    assert.match(
      account.avatar ?? "",
      new RegExp(`^/api/accounts/${account.id}/avatar\\?v=[0-9a-f]{16}$`)
    );
    assert.deepEqual(await client.me(), account);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
    assert.equal(
      (await sharp(await response.bytes()).metadata()).width,
      AVATAR_SIZE_PX
    );
  });

  test("revalidates an avatar requested without its current hash", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));
    const { client } = server.browser();
    await client.register("Alice", "correct horse");
    const account = await client.replaceAvatar(new Blob([await solidPng(8, 8)]));

    const response = await fetch(new URL(`${account.id}/avatar?v=stale`, server.url));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-cache");
  });

  test("answers not-found for an account without an avatar", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));
    const account = await server.browser().client.register("Alice", "correct horse");

    const response = await fetch(new URL(`${account.id}/avatar`, server.url));

    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "not-found");
  });

  test("refuses an upload without a session", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));

    const response = await fetch(new URL("avatar", server.url), {
      method: "PUT",
      body: await solidPng(8, 8)
    });

    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "unauthenticated");
  });

  test("refuses an upload that is not an image", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));
    const { client } = server.browser();
    await client.register("Alice", "correct horse");

    await assert.rejects(
      client.replaceAvatar(new Blob(["not an image"])),
      (error) => error instanceof AccountsRequestError &&
        error.status === 422 &&
        error.code === "invalid-avatar"
    );
  });

  test("refuses an upload over the size limit", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store));
    const { client, fetch: browserFetch } = server.browser();
    await client.register("Alice", "correct horse");
    const oversized = new Uint8Array(AVATAR_MAX_BYTES + 1);

    const response = await browserFetch(new URL("avatar", server.url), {
      method: "PUT",
      body: oversized
    });

    assert.equal(response.status, 413);
    await assert.rejects(
      client.replaceAvatar(new Blob([oversized])),
      (error) => error instanceof AccountsRequestError &&
        error.code === "payload-too-large"
    );
  });
});
