// Import Node.js Dependencies
import { randomBytes } from "node:crypto";
import http from "node:http";
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";
import {
  CATALOG_VIEW_ROOM,
  CatalogClient
} from "@jolly-pixel/asset-server/client";
import { WEBSOCKET_PROTOCOL } from "@jolly-pixel/network";
import { Client } from "@jolly-pixel/network/client";
import { Window } from "happy-dom";

// Import Internal Dependencies
import {
  createShareLink,
  guestSocket
} from "../helpers/shares.ts";
import { serveBackend } from "../helpers/studioBackend.ts";
import { browser } from "#src/testing.ts";

// CONSTANTS
const kPassword = "p".repeat(43);
const kTimeoutMs = 5_000;

describe("StudioBackend", () => {
  test("a share link's guest reads only the closure of its asset", async() => {
    await using backend = await serveBackend();
    const owner = browser(new URL(`.${ACCOUNTS_URL_PATH}`, backend.url));
    await owner.client.register("Alice", kPassword);
    const link = await createShareLink(owner, backend.url, "map-overworld");

    const guestPage = new Window({
      url: backend.url.href
    });
    const guest = new Client({
      reconnect: false,
      socket: () => guestSocket(guestPage, backend.socketUrl, link.token)
    });
    try {
      const catalog = await CatalogClient.connect(guest, {
        room: CATALOG_VIEW_ROOM,
        timeoutMs: kTimeoutMs
      });

      assert.deepEqual(
        [...catalog.records()].map((record) => record.id).sort(),
        ["blockset-overworld", "map-overworld"]
      );
    }
    finally {
      guest.destroy();
      await guestPage.happyDOM.close();
    }
  });

  test("leaves its sockets uncompressed by default", async() => {
    await using backend = await serveBackend();

    assert.equal(await negotiatedExtensions(backend.socketUrl), "");
  });

  test("compresses its sockets with permessage-deflate when asked", async() => {
    await using backend = await serveBackend({
      compression: true
    });

    assert.match(
      await negotiatedExtensions(backend.socketUrl),
      /^permessage-deflate/
    );
  });
});

async function negotiatedExtensions(
  socketUrl: string
): Promise<string> {
  const upgraded = Promise.withResolvers<string>();
  const request = http.request(socketUrl.replace(/^ws:/, "http:"), {
    headers: {
      Connection: "Upgrade",
      Upgrade: "websocket",
      "Sec-WebSocket-Version": "13",
      "Sec-WebSocket-Key": randomBytes(16).toString("base64"),
      "Sec-WebSocket-Protocol": WEBSOCKET_PROTOCOL,
      "Sec-WebSocket-Extensions": "permessage-deflate"
    }
  });
  request.once("upgrade", (response, socket) => {
    socket.destroy();
    upgraded.resolve(response.headers["sec-websocket-extensions"] ?? "");
  });
  request.once("response", (response) => {
    upgraded.reject(new Error(`Upgrade refused: ${response.statusCode}`));
  });
  request.once("error", upgraded.reject);
  request.end();

  return upgraded.promise;
}
