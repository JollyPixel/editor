// Import Node.js Dependencies
import type { IncomingHttpHeaders } from "node:http";
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { parseSetCookie } from "cookie";

// Import Internal Dependencies
import {
  createDirectory,
  sessionFor,
  storeWith
} from "../helpers/accounts.ts";
import type { AccountDirectory } from "#src/AccountDirectory.ts";
import type { Account } from "#src/index.ts";
import { CookieSessions } from "#src/session/CookieSessions.ts";
import {
  SessionCookie,
  type AccountStore
} from "#src/node.ts";

function createSessions(
  store: AccountStore,
  cookie = new SessionCookie()
): {
  sessions: CookieSessions;
  directory: AccountDirectory;
} {
  const directory = createDirectory(store);

  return {
    sessions: new CookieSessions(store, directory, cookie),
    directory
  };
}

function signedIn(
  directory: AccountDirectory,
  accountId: string
): Account {
  const account = directory.account(accountId);
  assert.ok(account);

  return account;
}

function headers(
  cookie?: string,
  origin?: string
): IncomingHttpHeaders {
  return {
    host: "studio.local",
    ...(cookie === undefined ? {} : { cookie }),
    ...(origin === undefined ? {} : { origin })
  };
}

function cookieHeader(
  setCookie: string
): string {
  const { name, value } = parseSetCookie(setCookie);

  return `${name}=${value}`;
}

describe("CookieSessions", () => {
  test("issues an HttpOnly strict cookie that resolves to its account", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    const { sessions, directory } = createSessions(store);
    const account = signedIn(directory, alice.id);

    const issued = sessions.open(account, true);
    const setCookie = parseSetCookie(issued);

    assert.equal(setCookie.name, "jolly_session");
    assert.equal(setCookie.httpOnly, true);
    assert.equal(setCookie.secure, true);
    assert.equal(setCookie.sameSite, "strict");
    assert.equal(setCookie.maxAge, 30 * 24 * 60 * 60);
    assert.deepEqual(
      sessions.account(headers(`theme=dark; ${cookieHeader(issued)}`)),
      account
    );
  });

  test("ends a session after the time to live of its cookie", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    using store = storeWith("Alice");
    const [alice] = store;
    const { sessions, directory } = createSessions(
      store,
      new SessionCookie({ ttlMs: 2_000 })
    );

    const issued = sessions.open(signedIn(directory, alice.id), false);

    assert.equal(parseSetCookie(issued).maxAge, 2);
    t.mock.timers.tick(1_999);
    assert.notEqual(sessions.account(headers(cookieHeader(issued))), null);
    t.mock.timers.tick(1);
    assert.equal(sessions.account(headers(cookieHeader(issued))), null);
  });

  test("ignores the cookie of a request from another origin", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    const { sessions } = createSessions(store);
    const cookie = `jolly_session=${sessionFor(store, alice.id)}`;

    assert.equal(sessions.account(headers(cookie, "http://evil.example")), null);
    assert.notEqual(sessions.account(headers(cookie, "http://studio.local")), null);
  });

  test("reads only the cookie it is configured with", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    const { sessions } = createSessions(
      store,
      new SessionCookie({ name: "project_session" })
    );
    const token = sessionFor(store, alice.id);

    assert.equal(sessions.account(headers(`jolly_session=${token}`)), null);
    assert.notEqual(sessions.account(headers(`project_session=${token}`)), null);
  });

  test("resolves no account without a cookie or for a malformed or unknown token", () => {
    using store = storeWith("Alice");
    const { sessions } = createSessions(store);

    assert.equal(sessions.account(headers()), null);
    assert.equal(sessions.account(headers("jolly_session=hunter2")), null);
    assert.equal(sessions.account(headers(`jolly_session=${"x".repeat(43)}`)), null);
  });

  test("closes the session, revokes its account once and clears the cookie", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    const { sessions, directory } = createSessions(store);
    const cookie = headers(`jolly_session=${sessionFor(store, alice.id)}`);
    const revoked: string[] = [];
    directory.watchRevocations((accountId) => revoked.push(accountId));

    const cleared = parseSetCookie(sessions.close(cookie, false));
    sessions.close(cookie, false);

    assert.equal(cleared.maxAge, 0);
    assert.equal(cleared.value, "");
    assert.equal(sessions.account(cookie), null);
    assert.deepEqual(revoked, [alice.id]);
  });
});
