// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { NotificationQueue } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { FileDownload } from "../../../src/browser/FileDownload.ts";
import { runExport } from "../../../src/shell/export/runExport.ts";
import { readChips } from "../../helpers/notifications.ts";

describe("runExport", () => {
  test("shows a loading notification until the download is saved", async() => {
    const notifications = new NotificationQueue();
    const { promise, resolve } = Promise.withResolvers<FileDownload>();

    const running = runExport(notifications, {
      label: "web game",
      fileName: "Quest v2",
      download: promise
    });

    assert.deepEqual(readChips(notifications), [
      "loading Exporting the web game"
    ]);

    resolve(new FileDownload(new Blob(["zip"]), "Quest-game.zip"));
    await running;

    assert.deepEqual(readChips(notifications), [
      "success Exported \"Quest v2.zip\""
    ]);
  });

  test("turns the loading notification into the export error", async() => {
    const notifications = new NotificationQueue();

    await runExport(notifications, {
      label: "web game",
      fileName: "",
      download: Promise.reject(new Error("the game player is not built"))
    });

    assert.deepEqual(readChips(notifications), [
      "error Could not export the web game: the game player is not built"
    ]);
  });
});
