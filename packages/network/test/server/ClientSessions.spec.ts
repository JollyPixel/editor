// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { identityOf } from "../helpers/server/identity.ts";
import { ClientSessions } from "#src/server/ClientSessions.ts";

function handle(
  id: string
) {
  return { id, send: () => void 0 };
}

describe("ClientSessions", () => {
  test("opens and closes a session", () => {
    const sessions = new ClientSessions();

    sessions.open(handle("A"), identityOf(handle("A")));
    assert.strictEqual(sessions.size, 1);
    const session = sessions.get("A");
    assert.ok(session);
    assert.deepEqual([...session.rooms], []);

    sessions.close("A");
    assert.strictEqual(sessions.get("A"), undefined);
    assert.strictEqual(sessions.size, 0);
  });

  test("clear drops every session and pending lane", () => {
    const sessions = new ClientSessions();
    const gate = Promise.withResolvers<void>();

    sessions.open(handle("A"), identityOf(handle("A")));
    sessions.open(handle("B"), identityOf(handle("B")));
    sessions.enqueue("A", () => gate.promise, "room-1");
    sessions.clear();

    assert.strictEqual(sessions.size, 0);
    assert.strictEqual(sessions.pending, 0);
    gate.resolve();
  });
});
