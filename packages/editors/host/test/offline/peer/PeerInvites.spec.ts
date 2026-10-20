// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Client,
  LoopbackTransport,
  Server
} from "@jolly-pixel/network";

// Import Internal Dependencies
import { PeerInvites } from "#src/offline/peer/PeerInvites.ts";

function openServer() {
  const invites = new PeerInvites();
  const loopback = new LoopbackTransport({
    server: new Server({ auth: invites })
  });
  const clients: Client[] = [];

  return {
    invites,
    connect(
      credential?: string
    ) {
      const client = new Client({
        socket: () => loopback.connect({ credential })
      });
      clients.push(client);
      const outcome = new Promise<"ready" | "unauthorized">((resolve) => {
        client.on("ready", () => resolve("ready"));
        client.on("unauthorized", () => resolve("unauthorized"));
      });
      client.room("probe").join();

      return outcome;
    },
    [Symbol.dispose]() {
      for (const client of clients) {
        client.destroy();
      }
    }
  };
}

describe("PeerInvites", () => {
  it("admits same-browser tabs and live invites, and nobody else", async() => {
    using server = openServer();
    const cleared = server.invites.issue();
    server.invites.clear();
    const token = server.invites.issue();

    const outcomes = await Promise.all([
      server.connect(),
      server.connect(token),
      server.connect(cleared),
      server.connect("forged"),
      server.connect("")
    ]);

    assert.deepEqual(outcomes, [
      "ready",
      "ready",
      "unauthorized",
      "unauthorized",
      "unauthorized"
    ]);
  });
});
