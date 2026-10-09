// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { databaseWith } from "../helpers/accounts.ts";
import { SessionToken } from "#src/session/SessionToken.ts";

// CONSTANTS
const kNever = Number.MAX_SAFE_INTEGER;

describe("SessionRepository", () => {
  test("resolves an open session to its account until it is closed", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    const token = SessionToken.mint();

    database.sessions.open(token, alice.id, kNever);
    assert.equal(database.sessions.owner(token), alice.id);

    assert.equal(database.sessions.close(token), alice.id);
    assert.equal(database.sessions.owner(token), null);
    assert.equal(database.sessions.close(token), null);
  });

  test("ends a session at its expiry", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    const token = SessionToken.mint();
    database.sessions.open(token, alice.id, 1_000);

    t.mock.timers.tick(999);
    assert.equal(database.sessions.owner(token), alice.id);

    t.mock.timers.tick(1);
    assert.equal(database.sessions.owner(token), null);
  });

  test("rejects a token it never minted while another session is open", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    database.sessions.open(SessionToken.mint(), alice.id, kNever);

    assert.equal(database.sessions.owner(SessionToken.mint()), null);
  });
});
