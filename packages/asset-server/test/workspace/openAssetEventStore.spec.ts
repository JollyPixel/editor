// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import {
  EVENTS_DB_PATH,
  openAssetEventStore,
  STATE_DIRECTORY
} from "#src/index.ts";
import { tempWorkspace } from "../helpers/tempWorkspace.ts";

describe("openAssetEventStore", () => {
  test("creates the state directory sqlite cannot create itself", async() => {
    await using workspace = await tempWorkspace();

    // The directory is missing on a first run: sqlite will not create the
    // file inside it, so the opener has to.
    await assert.rejects(
      fs.stat(path.join(workspace.root, STATE_DIRECTORY))
    );

    const eventStore = await openAssetEventStore(workspace.root);
    eventStore.close();

    const stats = await fs.stat(
      path.join(workspace.root, EVENTS_DB_PATH)
    );
    assert.strictEqual(stats.isFile(), true);
  });

  test("reopens an existing log", async() => {
    await using workspace = await tempWorkspace();

    const first = await openAssetEventStore(workspace.root);
    const appended = first.writer.append({
      assetType: "counter",
      assetId: "a1",
      eventType: "counter.incremented",
      eventData: {},
      actor: { type: "user", id: "tester" }
    });
    assert.ok(appended.ok);
    first.close();

    const second = await openAssetEventStore(workspace.root);
    assert.strictEqual(second.reader.listAll().length, 1);
    second.close();
  });
});
