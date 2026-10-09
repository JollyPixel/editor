// Import Node.js Dependencies
import http from "node:http";
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  activeAccount,
  createAccounts,
  createDatabase
} from "../../helpers/accounts.ts";
import { listenAccounts } from "../../helpers/accountsServer.ts";
import {
  AccountsRequestError,
  InvalidPasswordError
} from "#src/index.ts";
import {
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

describe("AccountsApi", () => {
  test("keeps the session in an HttpOnly cookie, never in the body", async() => {
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));
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
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));
    const { client, cookies } = server.browser();

    const account = await activeAccount(
      client.register("Alice", "correct horse")
    );

    assert.equal(account.username, "Alice");
    assert.equal(account.role, "admin");
    assert.deepEqual(await client.me(), account);

    await client.logout();
    assert.equal(cookies.size, 0);
    assert.equal(await client.me(), null);
  });

  test("logs in with the password the account registered with", async() => {
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));
    const registered = await activeAccount(
      server.browser().client.register("Alice", "correct horse")
    );
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
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database, {
      cookie: new SessionCookie({ name: "project_session" })
    }));
    const { client, cookies } = server.browser();

    await client.register("Alice", "correct horse");

    assert.deepEqual([...cookies.keys()], ["project_session"]);
    assert.notEqual(await client.me(), null);
  });

  test("refuses a request from another origin", async() => {
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));
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
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));
    await server.browser().client.register("Alice", "correct horse");

    await assert.rejects(
      server.browser().client.register("alice", "battery staple"),
      (error: AccountsRequestError) => error.status === 409 &&
        error.code === "username-taken"
    );
  });

  test("sets a Secure cookie from X-Forwarded-Proto only behind a proxy", async() => {
    async function cookieFrom(
      proxyHops: number
    ): Promise<string> {
      using database = createDatabase();
      await using server = await listenAccounts(createAccounts(database, {
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
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));

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
    assert.equal(database.accounts.size, 0);
  });

  test("refuses a body carrying prototype keys", async() => {
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));
    const credentials = `"username": "Alice", "password": "${"a".repeat(43)}"`;

    for (const pollution of [
      `"__proto__": { "role": "admin" }`,
      `"constructor": { "prototype": { "role": "admin" } }`
    ]) {
      const response = await fetch(new URL("register", server.url), {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: `{ ${credentials}, ${pollution} }`
      });

      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, "invalid-request");
    }
    assert.equal(database.accounts.size, 0);
  });

  test("refuses a body that is too large or has no length", async() => {
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));
    const url = new URL("login", server.url);

    const large = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ padding: "x".repeat(5_000) })
    });

    assert.equal(large.status, 413);
    assert.equal(await postChunked(url), 411);
  });

  test("refuses the wrong method and passes other routes on", async() => {
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));

    const wrongMethod = await fetch(new URL("register", server.url));
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get("allow"), "POST");
    assert.equal((await fetch(new URL("unknown", server.url))).status, 404);
    assert.equal((await fetch(new URL("/elsewhere", server.url))).status, 404);
  });

  test("checks the password length before sending anything", async() => {
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));

    await assert.rejects(
      server.browser().client.register("Alice", "short"),
      InvalidPasswordError
    );
    assert.equal(database.accounts.size, 0);
  });
});
