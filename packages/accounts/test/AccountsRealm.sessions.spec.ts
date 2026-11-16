// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PeerMetadata } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  ADDRESS,
  OTHER_REALM,
  PASSWORD,
  WRONG_PASSWORD,
  createAccounts,
  createRealm,
  databaseWith,
  insertAgentToken,
  openSession
} from "./helpers/accounts.ts";
import { solidPng } from "./helpers/avatar/images.ts";
import type { CredentialsBody } from "#src/index.ts";
import {
  AccountPendingError,
  InvalidCredentialsError,
  InvitationRequiredError,
  MembershipRequiredError,
  type Requester
} from "#src/node.ts";

// CONSTANTS
const kRequester: Requester = {
  address: ADDRESS,
  secure: false,
  headers: {}
};

function credentials(
  username: string,
  password = PASSWORD
): CredentialsBody {
  return {
    username,
    password: password.value
  };
}

describe("AccountsRealm.login", () => {
  test("opens no session for a request until an admin approves it", async() => {
    using accounts = createAccounts();
    const realm = createRealm(accounts);
    await realm.register(credentials("Alice"), kRequester);

    assert.deepEqual(await realm.register(credentials("Bob"), kRequester), {
      status: "pending"
    });
    await assert.rejects(
      realm.login(credentials("bob"), kRequester),
      AccountPendingError
    );
    await assert.rejects(
      realm.login(credentials("bob", WRONG_PASSWORD), kRequester),
      InvalidCredentialsError
    );
  });

  test("refuses an account of another realm, and signs in a member with its role", async() => {
    using accounts = createAccounts();
    const realm = createRealm(accounts, { join: "open" });
    const other = createRealm(accounts, {}, OTHER_REALM);
    await realm.register(credentials("Alice"), kRequester);
    await realm.register(credentials("Bob"), kRequester);

    await assert.rejects(
      other.login(credentials("bob"), kRequester),
      MembershipRequiredError
    );
    const { account, cookie } = await realm.login(credentials("bob"), kRequester);

    assert.equal(account.role, "spectator");
    assert.deepEqual(
      realm.signedIn({ cookie: cookie.split(";")[0] }),
      account
    );
    assert.equal(other.signedIn({ cookie: cookie.split(";")[0] }), null);
  });
});

describe("AccountsRealm.join", () => {
  test("enters a signed-in account the way the realm admits newcomers", async() => {
    using accounts = createAccounts();
    const home = createRealm(accounts, { join: "open" });
    await home.register(credentials("Alice"), kRequester);
    const registered = await home.register(credentials("Bob"), kRequester);
    assert.ok(registered.status === "active");
    const bob = registered.account;
    const open = createRealm(accounts, { join: "open" }, "open-realm");
    const requested = createRealm(accounts, { join: "request" }, "request-realm");
    const invited = createRealm(accounts, { join: "invite" }, "invite-realm");

    const joined = open.join(bob.id);

    assert.equal(joined.status, "active");
    assert.deepEqual(open.join(bob.id), joined);
    assert.deepEqual(requested.join(bob.id), { status: "pending" });
    assert.throws(() => requested.admit(bob.id), AccountPendingError);
    assert.throws(() => invited.join(bob.id), InvitationRequiredError);
    assert.throws(() => invited.admit(bob.id), MembershipRequiredError);
  });
});

describe("AccountsRealm.watchRevocations", () => {
  test("revokes the account that signs out, not its agents", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    insertAgentToken(database, alice.id);
    using accounts = createAccounts(database);
    const realm = createRealm(accounts);
    const revoked: string[] = [];
    const stop = realm.watchRevocations((accountId) => revoked.push(accountId));

    accounts.signOut({
      ...kRequester,
      headers: {
        cookie: `jolly_session=${openSession(database, alice.id)}`
      }
    });
    stop();

    assert.deepEqual(revoked, [alice.id]);
  });
});

describe("AccountsRealm.watchProfiles", () => {
  test("reports the profile of a member whose avatar changed, until stopped", async() => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    using accounts = createAccounts(database);
    const realm = createRealm(accounts, {}, OTHER_REALM);
    const changes: [string, PeerMetadata][] = [];
    const stop = realm.watchProfiles(
      (accountId, profile) => changes.push([accountId, profile])
    );

    const { avatar } = await accounts.replaceAvatar(alice.id, await solidPng(8, 8));
    await accounts.replaceAvatar(bob.id, await solidPng(8, 8));
    stop();
    await accounts.replaceAvatar(alice.id, await solidPng(4, 4));

    assert.deepEqual(changes, [[
      alice.id,
      {
        username: "Alice",
        peerId: alice.id,
        avatar
      }
    ]]);
  });
});
