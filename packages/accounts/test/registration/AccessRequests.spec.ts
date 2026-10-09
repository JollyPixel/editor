// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  activeAccount,
  createAccounts,
  createDatabase,
  name
} from "../helpers/accounts.ts";
import {
  listenAccounts,
  type AccountsServer
} from "../helpers/accountsServer.ts";
import type {
  Account,
  AccountsRequestError
} from "#src/index.ts";
import type { AccountsDatabase } from "#src/node.ts";

// CONSTANTS
const kSecret = "open sesame";
const kPassword = "correct horse";

interface Studio extends AccountsServer {
  admin: Account;
}

async function studioWithAdmin(
  database: AccountsDatabase,
  maxAccessRequests?: number
): Promise<Studio> {
  const server = await listenAccounts(createAccounts(database, {
    masterPassword: {
      secret: kSecret,
      accessRequests: true
    },
    maxAccessRequests
  }));
  const admin = await activeAccount(
    server.browser().client.register("Alice", kPassword, {
      masterPassword: kSecret
    })
  );

  return {
    ...server,
    admin
  };
}

describe("access requests", () => {
  test("answer a request as pending and refuse its sign-ins without a session", async() => {
    using database = createDatabase();
    await using studio = await studioWithAdmin(database);
    const { client, cookies } = studio.browser();

    assert.deepEqual(await client.register("Bob", kPassword), {
      status: "pending"
    });
    await assert.rejects(
      client.login("bob", kPassword),
      (error: AccountsRequestError) => error.status === 403 &&
        error.code === "account-pending"
    );
    await assert.rejects(
      client.login("bob", "wrong horse"),
      (error: AccountsRequestError) => error.code === "invalid-credentials"
    );
    assert.equal(cookies.size, 0);

    const request = database.accounts.named(name("bob"));
    assert.ok(request !== null);
    database.accounts.save(request.approved("member"));
    const bob = await client.login("bob", kPassword);

    assert.equal(bob.role, "member");
    assert.equal(cookies.size, 1);
  });

  test("refuse a request once access requests reach their limit", async() => {
    using database = createDatabase();
    await using studio = await studioWithAdmin(database, 1);
    const { client } = studio.browser();
    await client.register("Bob", kPassword);

    await assert.rejects(
      client.register("Carol", kPassword),
      (error: AccountsRequestError) => error.status === 429 &&
        error.code === "access-requests-full"
    );
  });
});
