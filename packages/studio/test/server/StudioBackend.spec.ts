// Import Node.js Dependencies
import http from "node:http";
import type { AddressInfo } from "node:net";
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
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";
import { Client } from "@jolly-pixel/network/client";
import { Window } from "happy-dom";

// Import Internal Dependencies
import { StudioBackend } from "../../server/StudioBackend.ts";
import {
  STUDIO_ROOT,
  StudioProject
} from "../../server/project/StudioProject.ts";
import { ShareLinksClient } from "../../src/shares/ShareLinksClient.ts";
import { SHARES_URL_PATH } from "../../src/shares/routes.ts";
import { guestSocket } from "../helpers/shares.ts";
import { browser } from "../helpers/studioApi.ts";

// CONSTANTS
const kPassword = "p".repeat(43);
const kTimeoutMs = 5_000;

interface ServedBackend extends AsyncDisposable {
  url: URL;
  socketUrl: string;
}

async function serveBackend(): Promise<ServedBackend> {
  const project = await StudioProject.open(
    StudioProject.resolveRoot(STUDIO_ROOT, {}),
    {
      inMemory: true
    }
  );
  const backend = await StudioBackend.open(project, {
    inMemory: true,
    accounts: {
      inMemory: true,
      defaultRole: "member"
    }
  });
  const server = http.createServer((request, response) => {
    backend.middleware(request, response, () => {
      response.statusCode = 404;
      response.end();
    });
  });
  backend.attach(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: new URL(`http://127.0.0.1:${port}/`),
    socketUrl: `ws://127.0.0.1:${port}${DEFAULT_WEBSOCKET_PATH}`,
    async [Symbol.asyncDispose]() {
      server.closeAllConnections();
      await new Promise((resolve) => {
        server.close(resolve);
      });
      await backend[Symbol.asyncDispose]();
    }
  };
}

describe("StudioBackend", () => {
  test("a share link's guest reads only the closure of its asset", async() => {
    await using backend = await serveBackend();
    const owner = browser(new URL(`.${ACCOUNTS_URL_PATH}`, backend.url));
    await owner.client.register("Alice", kPassword);
    const links = new ShareLinksClient({
      url: new URL(`.${SHARES_URL_PATH}`, backend.url),
      fetch: owner.fetch
    });
    const { link } = await links.create("map-overworld", "1d");

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
});
