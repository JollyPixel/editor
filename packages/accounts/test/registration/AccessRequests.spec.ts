// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ADDRESS,
  PASSWORD,
  WRONG_PASSWORD,
  createAccounts,
  createDatabase,
  name
} from "../helpers/accounts.ts";
import type { CredentialsBody } from "#src/index.ts";
import {
  AccessRequestsFullError,
  AccountPendingError,
  InvalidCredentialsError,
  type Accounts,
  type AccountsDatabase,
  type Requester
} from "#src/node.ts";

// CONSTANTS
const kSecret = "open sesame";
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

async function accountsWithAdmin(
  database: AccountsDatabase,
  maxAccessRequests?: number
): Promise<Accounts> {
  const accounts = createAccounts(database, {
    masterPassword: {
      secret: kSecret,
      accessRequests: true
    },
    maxAccessRequests
  });
  await accounts.register(
    {
      ...credentials("Alice"),
      masterPassword: kSecret
    },
    kRequester
  );

  return accounts;
}

describe("access requests", () => {
  test("keep a request pending without a session until an admin approves it", async() => {
    using database = createDatabase();
    using accounts = await accountsWithAdmin(database);

    assert.deepEqual(await accounts.register(credentials("Bob"), kRequester), {
      status: "pending"
    });
    await assert.rejects(
      accounts.login(credentials("bob"), kRequester),
      AccountPendingError
    );
    await assert.rejects(
      accounts.login(credentials("bob", WRONG_PASSWORD), kRequester),
      InvalidCredentialsError
    );

    const request = database.accounts.named(name("bob"));
    assert.ok(request !== null);
    database.accounts.save(request.approved("member"));
    const { account, cookie } = await accounts.login(credentials("bob"), kRequester);

    assert.equal(account.role, "member");
    assert.deepEqual(
      accounts.signedIn({ cookie: cookie.split(";")[0] }),
      account
    );
  });

  test("refuse a request once access requests reach their limit", async() => {
    using database = createDatabase();
    using accounts = await accountsWithAdmin(database, 1);
    await accounts.register(credentials("Bob"), kRequester);

    await assert.rejects(
      accounts.register(credentials("Carol"), kRequester),
      AccessRequestsFullError
    );
  });
});
