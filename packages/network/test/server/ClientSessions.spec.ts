// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createIdentity } from "../helpers/server/identity.ts";
import { ClientSessions } from "#src/server/ClientSessions.ts";
import { createConnection } from "../helpers/server/clientConnection.ts";

describe("ClientSessions", () => {
  test("clear drops every session and pending lane", () => {
    const sessions = new ClientSessions();
    const gate = Promise.withResolvers<void>();

    sessions.open(createConnection("A"), createIdentity("A"));
    sessions.open(createConnection("B"), createIdentity("B"));
    sessions.enqueue("A", () => gate.promise, "room-1");
    sessions.clear();

    assert.strictEqual(sessions.get("A"), undefined);
    assert.strictEqual(sessions.get("B"), undefined);
    assert.strictEqual(sessions.pending, 0);
    gate.resolve();
  });
});
