// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ADMIN_ROLE,
  type AccountsRequestError
} from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { requestStatus } from "../../../helpers/browser.ts";
import {
  PASSED_ON_STATUS,
  serveBackend
} from "../../../helpers/studioBackend.ts";

// CONSTANTS
const kDigest = "p".repeat(43);
const kSecret = "open sesame";

function postJson(
  url: URL,
  body: string,
  headers: Record<string, string> = {}
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json"
    },
    body
  });
}

function registerOverHttps(
  url: URL
): Promise<Response> {
  return postJson(
    new URL("register", url),
    JSON.stringify({
      username: "Alice",
      password: kDigest
    }),
    {
      "x-forwarded-proto": "https"
    }
  );
}

describe("accountsRoutes", () => {
  test("keeps the session in an HttpOnly cookie, never in the body", async() => {
    await using server = await serveBackend();

    const response = await postJson(
      new URL("register", server.accountsUrl),
      JSON.stringify({
        username: "Alice",
        password: kDigest
      })
    );

    assert.equal(response.status, 201);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(Object.keys(await response.json()), ["account"]);
    assert.match(
      response.headers.get("set-cookie") ?? "",
      /^jolly_session_[\da-f]{12}=[\w-]{43}; Max-Age=\d+; Path=\/; HttpOnly; SameSite=Strict$/
    );
  });

  test("marks the session cookie Secure when a trusted proxy forwards https", async() => {
    await using server = await serveBackend({
      trustProxy: true
    });

    const response = await registerOverHttps(server.accountsUrl);

    assert.equal(response.status, 201);
    assert.match(response.headers.get("set-cookie") ?? "", /; Secure(;|$)/);
  });

  test("ignores X-Forwarded-Proto from a peer it does not trust", async() => {
    await using server = await serveBackend();

    const response = await registerOverHttps(server.accountsUrl);

    assert.equal(response.status, 201);
    assert.doesNotMatch(response.headers.get("set-cookie") ?? "", /Secure/);
  });

  test("registers, resolves and closes a session", async() => {
    await using server = await serveBackend();
    const { client, cookies } = server.browser();

    const result = await client.register("Alice", "correct horse");
    assert.ok(result.status === "active");

    assert.equal(result.account.username, "Alice");
    assert.equal(result.account.role, ADMIN_ROLE);
    assert.deepEqual(await client.me(), result.account);

    await client.logout();
    assert.equal(cookies.size, 0);
    assert.equal(await client.me(), null);
  });

  test("logs in with the password the account registered with", async() => {
    await using server = await serveBackend();
    const registered = await server.browser().client.register("Alice", "correct horse");
    assert.ok(registered.status === "active");
    const { client } = server.browser();

    assert.deepEqual(await client.login("ALICE", "correct horse"), registered.account);
    assert.deepEqual(await client.me(), registered.account);
    await assert.rejects(
      client.login("Alice", "wrong horse"),
      (error: AccountsRequestError) => error.status === 401 &&
        error.code === "invalid-credentials"
    );
  });

  test("refuses a taken username", async() => {
    await using server = await serveBackend();
    await server.browser().client.register("Alice", "correct horse");

    await assert.rejects(
      server.browser().client.register("alice", "battery staple"),
      (error: AccountsRequestError) => error.status === 409 &&
        error.code === "username-taken"
    );
  });

  test("sends the master password with a registration and answers its refusals", async() => {
    await using server = await serveBackend({
      masterPassword: kSecret
    });
    const { client } = server.browser();

    await assert.rejects(
      client.register("Alice", "correct horse"),
      (error: AccountsRequestError) => error.status === 403 &&
        error.code === "master-password-required"
    );
    await assert.rejects(
      client.register("Alice", "correct horse", {
        masterPassword: "guess"
      }),
      (error: AccountsRequestError) => error.status === 403 &&
        error.code === "invalid-master-password"
    );
    const alice = await client.register("Alice", "correct horse", {
      masterPassword: kSecret
    });

    assert.equal(alice.status, "active");
  });

  test("answers an access request without a cookie and refuses its sign-in", async() => {
    await using server = await serveBackend({
      masterPassword: kSecret,
      accessRequests: true
    });
    await server.browser().client.register("Alice", "correct horse", {
      masterPassword: kSecret
    });
    const { client, cookies } = server.browser();

    assert.deepEqual(await client.register("Bob", "correct horse"), {
      status: "pending"
    });
    await assert.rejects(
      client.login("Bob", "correct horse"),
      (error: AccountsRequestError) => error.status === 403 &&
        error.code === "account-pending"
    );
    assert.equal(cookies.size, 0);
  });

  test("refuses a request from another origin", async() => {
    await using server = await serveBackend();
    const { client, fetch: browserFetch } = server.browser();
    await client.register("Alice", "correct horse");

    const response = await browserFetch(new URL("me", server.accountsUrl), {
      headers: {
        origin: "http://evil.example"
      }
    });

    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "cross-origin");
  });

  test("refuses a password that is not a pre-hashed digest", async() => {
    await using server = await serveBackend();

    const response = await postJson(
      new URL("register", server.accountsUrl),
      JSON.stringify({
        username: "Alice",
        password: "correct horse"
      })
    );

    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "invalid-password");
  });

  test("refuses a body without the credentials shape", async() => {
    await using server = await serveBackend();

    for (const route of ["register", "login"]) {
      const response = await postJson(
        new URL(route, server.accountsUrl),
        JSON.stringify({
          username: "Alice"
        })
      );

      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, "invalid-request");
    }
  });

  test("refuses a body carrying prototype keys", async() => {
    await using server = await serveBackend();
    const credentials = `"username": "Alice", "password": "${kDigest}"`;

    for (const pollution of [
      `"__proto__": { "role": "admin" }`,
      `"constructor": { "prototype": { "role": "admin" } }`
    ]) {
      const response = await postJson(
        new URL("register", server.accountsUrl),
        `{ ${credentials}, ${pollution} }`
      );

      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, "invalid-request");
    }
    assert.equal(await server.browser().client.me(), null);
  });

  test("refuses a body over 4 KiB, with or without a length", async() => {
    await using server = await serveBackend();
    const url = new URL("login", server.accountsUrl);
    const large = JSON.stringify({
      padding: "x".repeat(5_000)
    });

    const response = await postJson(url, large);

    assert.equal(response.status, 413);
    assert.equal((await response.json()).code, "payload-too-large");
    assert.equal(
      await requestStatus(url, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: large
      }),
      413
    );
  });

  test("answers an unknown API route with not-found and passes other paths on", async() => {
    await using server = await serveBackend();

    const unknown = await fetch(new URL("unknown", server.accountsUrl));

    assert.equal(unknown.status, 404);
    assert.equal((await unknown.json()).code, "not-found");
    assert.equal((await fetch(new URL("/elsewhere", server.url))).status, PASSED_ON_STATUS);
  });
});
