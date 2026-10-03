// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { serverMessageProtocol } from "#src/sync/serverMessageProtocol.ts";
import { MessageParser } from "#src/protocol/message/MessageParser.ts";
import {
  CATCH_UP_EVENT,
  SNAPSHOT_EVENT
} from "#src/protocol/constants.ts";
import { actionCommandProtocol } from "../helpers/protocols.ts";

describe("serverMessageProtocol", () => {
  test("names a snapshot with the reserved event and a command or correction with its action", () => {
    const protocol = serverMessageProtocol({
      command: actionCommandProtocol,
      snapshot: { type: "object" }
    });

    assert.deepEqual(protocol.events, [
      SNAPSHOT_EVENT,
      "voxel-set",
      "object-added",
      "voxel-set",
      "object-added",
      CATCH_UP_EVENT
    ]);
  });

  test("appends notices named by their title or \"type\" constant", () => {
    const protocol = serverMessageProtocol({
      command: actionCommandProtocol,
      snapshot: { type: "object" },
      notices: [
        {
          title: "$deleted",
          type: "object",
          properties: { type: { const: "deleted" } },
          required: ["type"]
        },
        {
          type: "object",
          properties: { type: { const: "rejected" } },
          required: ["type"]
        }
      ]
    });

    assert.deepEqual(protocol.events.slice(-2), ["$deleted", "rejected"]);
  });

  test("resolves a server message to the inner command's event", () => {
    const parser = new MessageParser(serverMessageProtocol({
      command: actionCommandProtocol,
      snapshot: { type: "object" }
    }));

    const snapshot = parser.parse({ type: "snapshot", data: {} });
    assert.ok(snapshot.ok);
    assert.strictEqual(snapshot.val.event, SNAPSHOT_EVENT);

    const command = parser.parse({
      type: "command",
      data: { action: "object-added" }
    });
    assert.ok(command.ok);
    assert.strictEqual(command.val.event, "object-added");

    const correction = parser.parse({
      type: "correction",
      data: { action: "voxel-set" }
    });
    assert.ok(correction.ok);
    assert.strictEqual(correction.val.event, "voxel-set");
  });

  test("declares a non-negative room version and acks", () => {
    const parser = new MessageParser(serverMessageProtocol({
      command: actionCommandProtocol,
      snapshot: { type: "object" }
    }));

    assert.ok(parser.parse({ type: "command", data: { action: "voxel-set" }, version: 4 }).ok);
    assert.ok(parser.parse({ type: "snapshot", data: {}, version: 4, acks: { A: 2 } }).ok);
    assert.strictEqual(
      parser.parse({ type: "command", data: { action: "voxel-set" }, version: -1 }).ok,
      false
    );
    assert.strictEqual(
      parser.parse({ type: "snapshot", data: {}, acks: { A: -1 } }).ok,
      false
    );
  });

  test("validates every command of a catch-up", () => {
    const parser = new MessageParser(serverMessageProtocol({
      command: actionCommandProtocol,
      snapshot: { type: "object" }
    }));

    const caughtUp = parser.parse({
      type: "catch-up",
      data: [{ action: "voxel-set" }, { action: "object-added" }],
      version: 9,
      acks: { A: 3 }
    });
    assert.ok(caughtUp.ok);
    assert.strictEqual(caughtUp.val.event, CATCH_UP_EVENT);
    assert.strictEqual(
      parser.parse({ type: "catch-up", data: [{ action: "unknown" }], version: 9 }).ok,
      false
    );
  });
});
