// Import Node.js Dependencies
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  insertAccount,
  name
} from "../helpers/accounts.ts";
import { AccountEntity } from "#src/account/AccountEntity.ts";
import { SessionToken } from "#src/session/SessionToken.ts";
import { SqliteDatabase } from "#src/store/SqliteDatabase.ts";
import { AccountsDatabase } from "#src/node.ts";

describe("AccountsDatabase.open", () => {
  test("persists accounts and sessions to a file", async(t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "accounts-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const location = path.join(directory, "state", "accounts.db");
    const token = SessionToken.mint();

    const written = await AccountsDatabase.open(location);
    const alice = insertAccount(written, AccountEntity.claim(name("Alice")));
    written.sessions.open(token, alice.id, Number.MAX_SAFE_INTEGER);
    written.close();

    using reopened = await AccountsDatabase.open(location);
    assert.deepEqual(reopened.accounts.byId(alice.id), alice);
    assert.equal(reopened.sessions.owner(token), alice.id);
  });
});

describe("AccountsDatabase", () => {
  test("makes the oldest active admin the owner of a database written without one", () => {
    const db = new SqliteDatabase(
      new DatabaseSync(":memory:")
    );
    const before = new AccountsDatabase(db);
    const alice = insertAccount(before, AccountEntity.claim(name("Alice")));
    for (const username of ["Bob", "Carol"]) {
      insertAccount(before, AccountEntity.register(name(username), "admin"));
    }
    db.exec("DROP TABLE ownership");
    db.run("UPDATE users SET role = 'member' WHERE id = ?", alice.id);

    using database = new AccountsDatabase(db);

    assert.deepEqual(
      [...database.accounts].map(({ username, owner }) => [username, owner]),
      [["Alice", false], ["Bob", true], ["Carol", false]]
    );
  });
});
