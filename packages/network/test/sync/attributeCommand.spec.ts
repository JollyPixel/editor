// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { attributeCommand } from "#src/sync/attributeCommand.ts";

describe("attributeCommand", () => {
  test("replaces the clientId the sender claimed with the connection's id", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1_000 });
    const command = {
      action: "paint",
      clientId: "someone-else",
      seq: 3,
      timestamp: 100
    };

    assert.deepEqual(attributeCommand(command, "sender"), {
      action: "paint",
      clientId: "sender",
      seq: 3,
      timestamp: 100
    });
    assert.strictEqual(command.clientId, "someone-else");
  });

  test("clamps a timestamp from the future to the server's clock", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1_000 });
    const command = attributeCommand({ timestamp: 9_999_999 }, "sender");

    assert.strictEqual(command.timestamp, 1_000);
  });

  test("leaves a command without timestamp without one", () => {
    assert.deepEqual(attributeCommand({ seq: 1 }, "sender"), {
      seq: 1,
      clientId: "sender"
    });
  });
});
