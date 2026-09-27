// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { serverMessageProtocol } from "#src/sync/serverMessageProtocol.ts";
import { MessageParser } from "#src/protocol/message/MessageParser.ts";
import { SNAPSHOT_EVENT } from "#src/protocol/constants.ts";
import { actionCommandProtocol } from "../helpers/protocols.ts";

describe("serverMessageProtocol", () => {
  test("names a snapshot with the reserved event and a command with its action", () => {
    const protocol = serverMessageProtocol({
      command: actionCommandProtocol,
      snapshot: { type: "object" }
    });

    assert.deepEqual(protocol.events, [
      SNAPSHOT_EVENT,
      "voxel-set",
      "object-added"
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
  });
});
