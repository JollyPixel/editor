// Import Node.js Dependencies
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
import { Client } from "@jolly-pixel/network/client";
import { Window } from "happy-dom";

// Import Internal Dependencies
import { ShareLinksClient } from "../../src/shares/ShareLinksClient.ts";
import { SHARES_URL_PATH } from "../../src/shares/routes.ts";
import { guestSocket } from "../helpers/shares.ts";
import { serveBackend } from "../helpers/studioBackend.ts";
import { browser } from "../helpers/studioApi.ts";

// CONSTANTS
const kPassword = "p".repeat(43);
const kTimeoutMs = 5_000;

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
