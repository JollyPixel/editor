// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

// Import Internal Dependencies
import {
  createDirectory,
  insertAccount,
  name
} from "../helpers/accounts.ts";
import { AccountEntity } from "#src/account/AccountEntity.ts";
import { AgentTokens } from "#src/agent/AgentTokens.ts";
import { AgentTokenNotFoundError } from "#src/agent/errors/AgentTokenNotFoundError.ts";
import { AgentTokenRefusedError } from "#src/agent/errors/AgentTokenRefusedError.ts";
import { SessionToken } from "#src/session/SessionToken.ts";
import { AccountsDatabase } from "#src/store/AccountsDatabase.ts";
import { SqliteDatabase } from "#src/store/SqliteDatabase.ts";

interface Harness extends Disposable {
  sqlite: DatabaseSync;
  tokens: AgentTokens;
  revoked: string[];
  alice: string;
  bob: string;
}

function harness(): Harness {
  const sqlite = new DatabaseSync(":memory:");
  const database = new AccountsDatabase(new SqliteDatabase(sqlite));
  const alice = insertAccount(database, AccountEntity.claim(name("Alice")));
  const bob = insertAccount(
    database,
    AccountEntity.register(name("Bob"), "member")
  );
  const directory = createDirectory(database);
  const revoked: string[] = [];
  directory.on("revoked", (subject) => revoked.push(subject));

  return {
    sqlite,
    tokens: new AgentTokens(database.agentTokens, directory),
    revoked,
    alice: alice.id,
    bob: bob.id,
    [Symbol.dispose]() {
      database.close();
    }
  };
}

describe("AgentTokens", () => {
  test("finds a live token by its value, and any token by its subject", () => {
    using h = harness();

    const { token, value } = h.tokens.create({
      ownerId: h.alice
    });

    assert.equal(token.name, "Golem");
    assert.deepEqual(h.tokens.find(value), token);
    assert.equal(h.tokens.find(SessionToken.mint().value), null);
    assert.equal(h.tokens.find("not a token"), null);

    h.tokens.revoke(h.alice, token.id);

    assert.equal(h.tokens.find(value), null);
    assert.deepEqual(h.tokens.bySubject(`agent:${token.id}`), token);
    assert.equal(h.tokens.bySubject(token.id), null);
  });

  test("lists and revokes only the live tokens of their owner", () => {
    using h = harness();
    const first = h.tokens.create({
      ownerId: h.alice,
      name: "Builder"
    }).token;
    const second = h.tokens.create({
      ownerId: h.alice
    }).token;
    const other = h.tokens.create({
      ownerId: h.bob
    }).token;

    assert.throws(
      () => h.tokens.revoke(h.bob, first.id),
      AgentTokenNotFoundError
    );
    h.tokens.revoke(h.alice, first.id);
    assert.throws(
      () => h.tokens.revoke(h.alice, first.id),
      AgentTokenNotFoundError
    );

    assert.deepEqual(h.tokens.ownedBy(h.alice), [second]);
    assert.deepEqual(h.tokens.ownedBy(h.bob), [other]);
    assert.deepEqual(h.revoked, [`agent:${first.id}`]);
  });

  test("trims the name and refuses an empty or long name, and an unknown owner", () => {
    using h = harness();

    assert.equal(
      h.tokens.create({
        ownerId: h.alice,
        name: "  Builder "
      }).token.name,
      "Builder"
    );
    for (const refused of [" ", "x".repeat(33)]) {
      assert.throws(
        () => h.tokens.create({
          ownerId: h.alice,
          name: refused
        }),
        AgentTokenRefusedError
      );
    }
    assert.throws(
      () => h.tokens.create({
        ownerId: "nobody"
      }),
      AgentTokenRefusedError
    );
    assert.equal(h.tokens.ownedBy(h.alice).length, 1);
  });

  test("stores the digest of the value, never the value", () => {
    using h = harness();

    const { value } = h.tokens.create({
      ownerId: h.alice
    });
    const rows = h.sqlite.prepare("SELECT * FROM agent_tokens").all();

    assert.equal(rows.length, 1);
    assert.deepEqual(
      Buffer.from(rows[0].token_hash as Uint8Array),
      createHash("sha256").update(value).digest()
    );
    assert.ok(
      !Object.values(rows[0]).some((column) => String(column).includes(value))
    );
  });
});
