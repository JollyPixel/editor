// Import Node.js Dependencies
import { describe, test, before, after } from "node:test";
import assert from "node:assert";

// Import Internal Dependencies
import { createServer } from "../src/server.js";
import { openWebsocketClient } from "./client.js";

let backend: ReturnType<typeof createServer>;

before(() => {
  backend = createServer();
});

after(() => {
  backend.handler.broadcastReconnectNotification();
  backend.wss.close();
});

describe("TRPC: discussion", () => {
  test("do work", async() => {
    const client = openWebsocketClient();

    try {
      const data = await client.trpc.discussion.join.query();

      assert.strictEqual(data, "join room");
    }
    finally {
      client.wss.close();
    }
  });
});
