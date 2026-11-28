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
  REALM,
  addMembership,
  createMembers,
  insertAccount,
  name
} from "../helpers/accounts.ts";
import { solidPng } from "../helpers/avatar/images.ts";
import { AccountEntity } from "#src/account/AccountEntity.ts";
import { AgentTokens } from "#src/agent/AgentTokens.ts";
import { InvalidAvatarError } from "#src/avatar/errors/InvalidAvatarError.ts";
import { Membership } from "#src/realm/Membership.ts";
import { AgentTokenNotFoundError } from "#src/agent/errors/AgentTokenNotFoundError.ts";
import { AgentTokenRefusedError } from "#src/agent/errors/AgentTokenRefusedError.ts";
import { SessionToken } from "#src/session/SessionToken.ts";
import { AccountsDatabase } from "#src/store/AccountsDatabase.ts";
import { SqliteDatabase } from "#src/store/SqliteDatabase.ts";

interface Harness extends Disposable {
  sqlite: DatabaseSync;
  database: AccountsDatabase;
  tokens: AgentTokens;
  revoked: string[];
  disconnected: string[];
  reprofiled: [string, string | null][];
  alice: string;
  bob: string;
}

function harness(): Harness {
  const sqlite = new DatabaseSync(":memory:");
  const database = new AccountsDatabase(new SqliteDatabase(sqlite));
  const alice = insertAccount(database, AccountEntity.claim(name("Alice")));
  const bob = insertAccount(
    database,
    AccountEntity.register(name("Bob"))
  );
  addMembership(database, Membership.active(REALM, bob.id, "member"));
  const members = createMembers(database);
  const revoked: string[] = [];
  members.on("revoked", (subject) => revoked.push(subject));
  const disconnected: string[] = [];
  members.on("disconnected", (subject) => disconnected.push(subject));
  const reprofiled: [string, string | null][] = [];
  members.on(
    "avatar",
    (subject, avatar) => reprofiled.push([subject, avatar])
  );

  return {
    sqlite,
    database,
    tokens: new AgentTokens(
      database.agentTokens,
      database.agentAvatars,
      members
    ),
    revoked,
    disconnected,
    reprofiled,
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

  test("disconnects only a live token of its owner and keeps it working", () => {
    using h = harness();
    const { token, value } = h.tokens.create({
      ownerId: h.alice
    });
    const revoked = h.tokens.create({
      ownerId: h.alice
    }).token;
    h.tokens.revoke(h.alice, revoked.id);

    for (const [ownerId, tokenId] of [
      [h.bob, token.id],
      [h.alice, revoked.id],
      [h.alice, "unknown"]
    ]) {
      assert.throws(
        () => h.tokens.disconnect(ownerId, tokenId),
        AgentTokenNotFoundError
      );
    }
    assert.deepEqual(h.tokens.disconnect(h.alice, token.id), token);

    assert.deepEqual(h.disconnected, [`agent:${token.id}`]);
    assert.deepEqual(h.revoked, [`agent:${revoked.id}`]);
    assert.deepEqual(h.tokens.find(value), token);
  });

  test("replaces the avatar of a live token of its owner and points the token at it", async() => {
    using h = harness();
    const { token, value } = h.tokens.create({
      ownerId: h.alice
    });
    const revoked = h.tokens.create({
      ownerId: h.alice
    }).token;
    h.tokens.revoke(h.alice, revoked.id);
    const image = await solidPng(8, 8);

    for (const [ownerId, tokenId] of [
      [h.bob, token.id],
      [h.alice, revoked.id],
      [h.alice, "unknown"]
    ]) {
      await assert.rejects(
        h.tokens.replaceAvatar(ownerId, tokenId, image),
        AgentTokenNotFoundError
      );
    }
    await assert.rejects(
      h.tokens.replaceAvatar(h.alice, token.id, new Uint8Array([1, 2, 3])),
      InvalidAvatarError
    );
    assert.deepEqual(h.reprofiled, []);

    const replaced = await h.tokens.replaceAvatar(h.alice, token.id, image);
    const stored = h.database.agentAvatars.find(token.id);

    assert.ok(stored !== null);
    assert.equal(
      replaced.avatar,
      `/api/accounts/agents/${token.id}/avatar?v=${stored.hash}`
    );
    assert.deepEqual(h.reprofiled, [[`agent:${token.id}`, replaced.avatar]]);
    assert.deepEqual(h.tokens.ownedBy(h.alice), [replaced]);
    assert.deepEqual(h.tokens.find(value), replaced);
    assert.equal(h.database.agentAvatars.find(revoked.id), null);
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
