// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CATALOG_CHANGED,
  CATALOG_FOLDERS,
  type CatalogChange,
  type CatalogMessage
} from "#src/index.ts";
import { CatalogOutbox } from "#src/catalog/CatalogOutbox.ts";

function deleted(
  assetId: string
): CatalogChange {
  return {
    eventType: "asset.deleted",
    assetId,
    record: null
  };
}

function recordingOutbox() {
  const sent: CatalogMessage[] = [];
  const outbox = new CatalogOutbox((message) => sent.push(message));

  return {
    outbox,
    sent
  };
}

describe("CatalogOutbox", () => {
  test("sends each change and folder list at once when nothing holds it", () => {
    const { outbox, sent } = recordingOutbox();

    outbox.pushChange(deleted("a1"));
    outbox.pushFolders(["maps"]);

    assert.deepEqual(sent, [
      {
        type: CATALOG_CHANGED,
        changes: [deleted("a1")]
      },
      {
        type: CATALOG_FOLDERS,
        folders: ["maps"]
      }
    ]);
  });

  test("holds back a task's messages, then sends the latest folders and every change", async() => {
    const { outbox, sent } = recordingOutbox();

    const result = await outbox.hold(async() => {
      outbox.pushChange(deleted("a1"));
      outbox.pushFolders(["maps"]);
      outbox.pushChange(deleted("a2"));
      outbox.pushFolders(["maps", "textures"]);
      assert.deepEqual(sent, []);

      return "done";
    });

    assert.strictEqual(result, "done");
    assert.deepEqual(sent, [
      {
        type: CATALOG_FOLDERS,
        folders: ["maps", "textures"]
      },
      {
        type: CATALOG_CHANGED,
        changes: [deleted("a1"), deleted("a2")]
      }
    ]);
  });

  test("keeps holding until the last of overlapping tasks settles", async() => {
    const { outbox, sent } = recordingOutbox();
    const first = Promise.withResolvers<void>();

    const held = outbox.hold(() => first.promise);
    await outbox.hold(async() => outbox.pushChange(deleted("a1")));
    assert.deepEqual(sent, []);

    first.resolve();
    await held;
    assert.strictEqual(sent.length, 1);
  });

  test("an explicit flush sends what is held so far", async() => {
    const { outbox, sent } = recordingOutbox();

    await outbox.hold(async() => {
      outbox.pushChange(deleted("a1"));
      outbox.flush();
      outbox.pushChange(deleted("a2"));
    });

    assert.deepEqual(sent, [
      {
        type: CATALOG_CHANGED,
        changes: [deleted("a1")]
      },
      {
        type: CATALOG_CHANGED,
        changes: [deleted("a2")]
      }
    ]);
  });

  test("still sends what it held when the task throws", async() => {
    const { outbox, sent } = recordingOutbox();

    await assert.rejects(outbox.hold(async() => {
      outbox.pushChange(deleted("a1"));
      throw new Error("boom");
    }));

    assert.strictEqual(sent.length, 1);
  });
});
