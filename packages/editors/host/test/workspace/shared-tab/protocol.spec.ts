// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CHANNEL_TRANSPORT_TAG } from "@jolly-pixel/network/transport/channel.ts";

// Import Internal Dependencies
import { parseOwnerMessage } from "#src/workspace/shared-tab/protocol.ts";

describe("parseOwnerMessage", () => {
  it("returns a well-formed owner message", () => {
    const message = { type: "heartbeat", tab: "*", owner: "owner-1" };

    assert.deepEqual(parseOwnerMessage(message), message);
  });

  it("rejects malformed owner messages", () => {
    assert.strictEqual(parseOwnerMessage({ type: "owner", tab: "tab-a" }), undefined);
    assert.strictEqual(parseOwnerMessage({ type: "stopping", tab: "tab-a", owner: "owner-1" }), undefined);
    assert.strictEqual(parseOwnerMessage(null), undefined);
  });

  it("ignores channel transport messages sharing the port", () => {
    const message = {
      tag: CHANNEL_TRANSPORT_TAG,
      type: "close",
      host: "owner-1",
      socket: "socket-1"
    };

    assert.strictEqual(parseOwnerMessage(message), undefined);
  });
});
