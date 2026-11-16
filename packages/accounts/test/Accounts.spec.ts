// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ADDRESS,
  OTHER_REALM,
  PASSWORD,
  REALM,
  createAccounts,
  createRealm
} from "./helpers/accounts.ts";
import type { Requester } from "#src/node.ts";

// CONSTANTS
const kRequester: Requester = {
  address: ADDRESS,
  secure: false,
  headers: {}
};

describe("Accounts.login", () => {
  test("signs an account in server-wide, whatever realm it belongs to", async() => {
    using accounts = createAccounts();
    const realm = createRealm(accounts, { join: "open" });
    await realm.register({ username: "Alice", password: PASSWORD.value }, kRequester);
    await realm.register({ username: "Bob", password: PASSWORD.value }, kRequester);

    const { account, cookie } = await accounts.login(
      {
        username: "bob",
        password: PASSWORD.value
      },
      kRequester
    );

    assert.deepEqual(
      [account.username, account.owner, "role" in account],
      ["Bob", false, false]
    );
    assert.deepEqual(
      accounts.signedIn({ cookie: cookie.split(";")[0] }),
      account
    );
  });
});

describe("Accounts.realm", () => {
  test("opens each realm once until it is disposed", () => {
    using accounts = createAccounts();
    const realm = createRealm(accounts);
    createRealm(accounts, {}, OTHER_REALM);

    assert.throws(() => createRealm(accounts), Error);
    realm[Symbol.dispose]();

    assert.equal(createRealm(accounts).id, REALM);
  });
});
