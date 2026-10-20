// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import { AssetProjector, ProjectionState } from "#src/storage/projection/index.ts";
import { encodeContent } from "#src/model/events/inlineContent.ts";
import { ContentObjects } from "#src/storage/ContentObjects.ts";
import { syncHarness } from "../../helpers/backend.ts";
import { bytes, text } from "../../helpers/bytes.ts";
import { recordingLogger } from "../../helpers/logger.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

class SlowAssetSource extends MemoryAssetSource {
  override async write(
    path: string,
    data: Uint8Array
  ): Promise<void> {
    await setImmediate();
    await super.write(path, data);
  }
}

describe("AssetProjector — malformed events", () => {
  test("a payload that does not match its type is skipped", async() => {
    await using harness = await syncHarness();

    const created = await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    assert.ok(created.ok);
    await harness.projector.flush();

    const appended = harness.eventStore.writer.append({
      assetType: "binary",
      assetId: created.val.assetId,
      eventType: "asset.updated",
      eventData: { path: "a.png", kind: "binary", hash: "h2" },
      actor: kActor
    });
    assert.ok(appended.ok);
    await harness.projector.flush();

    assert.strictEqual(
      text(await harness.source.read("a.png")),
      "one"
    );
    assert.strictEqual(harness.projector.pending, 0);
  });

  test("a malformed event keeps the replayed desired state", async() => {
    const source = new MemoryAssetSource();
    using eventStore = EventStore.persistence.memory();
    await using harness = await syncHarness({ source, eventStore });

    const created = await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    assert.ok(created.ok);

    const appended = eventStore.writer.append({
      assetType: "binary",
      assetId: created.val.assetId,
      eventType: "asset.renamed",
      eventData: "not-an-object",
      actor: kActor
    });
    assert.ok(appended.ok);

    const replayed = new AssetProjector({
      source,
      eventStore,
      state: await ProjectionState.load(source),
      objects: new ContentObjects(source)
    });

    replayed.load();
    assert.strictEqual(replayed.desired(created.val.assetId)?.path, "a.png");
  });
});

describe("AssetProjector — rejected events", () => {
  test(
    "warns about a malformed event, naming the offending field",
    async() => {
      const source = new MemoryAssetSource();
      using eventStore = EventStore.persistence.memory();
      await using harness = await syncHarness({ source, eventStore });

      const created = await harness.writer.create({
        path: "a.png",
        data: bytes("one"),
        actor: kActor
      });
      assert.ok(created.ok);
      assert.ok(eventStore.writer.append({
        assetType: "binary",
        assetId: created.val.assetId,
        eventType: "asset.deleted",
        eventData: { path: "a.png" },
        actor: kActor
      }).ok);

      const { logger, records } = recordingLogger();
      new AssetProjector({
        source,
        eventStore,
        state: await ProjectionState.load(source),
        objects: new ContentObjects(source),
        logger
      }).load();

      const warnings = records.filter((record) => record.level === "warn");
      assert.strictEqual(warnings.length, 1);
      assert.strictEqual(warnings[0].metadata.reason, "malformed");
      assert.match(String(warnings[0].metadata.detail), /kind/);
    }
  );

  test(
    "does not warn about an asset event type it does not know",
    async() => {
      const source = new MemoryAssetSource();
      using eventStore = EventStore.persistence.memory();
      await using harness = await syncHarness({ source, eventStore });

      const created = await harness.writer.create({
        path: "a.png",
        data: bytes("one"),
        actor: kActor
      });
      assert.ok(created.ok);
      assert.ok(eventStore.writer.append({
        assetType: "binary",
        assetId: created.val.assetId,
        eventType: "asset.archived",
        eventData: {},
        actor: kActor
      }).ok);

      const { logger, records } = recordingLogger();
      new AssetProjector({
        source,
        eventStore,
        state: await ProjectionState.load(source),
        objects: new ContentObjects(source),
        logger
      }).load();

      assert.deepEqual(
        records.filter((record) => record.level === "warn"),
        []
      );
    }
  );

  test("skips a content reference rather than throwing", async() => {
    const source = new MemoryAssetSource();
    using eventStore = EventStore.persistence.memory();

    assert.ok(eventStore.writer.append({
      assetType: "binary",
      assetId: "a1",
      eventType: "asset.created",
      eventData: {
        path: "a.png",
        kind: "binary",
        hash: "h1",
        size: 3,
        content: encodeContent(bytes("one"))
      },
      actor: kActor
    }).ok);
    assert.ok(eventStore.writer.append({
      assetType: "binary",
      assetId: "a1",
      eventType: "asset.updated",
      eventData: {
        path: "a.png",
        kind: "binary",
        hash: "h2",
        size: 3,
        content: {
          type: "ref",
          hash: "h2",
          size: 3
        }
      },
      actor: kActor
    }).ok);

    const { logger, records } = recordingLogger();
    const projector = new AssetProjector({
      source,
      eventStore,
      state: await ProjectionState.load(source),
      objects: new ContentObjects(source),
      logger
    });

    projector.load();
    assert.strictEqual(projector.desired("a1"), null);
    assert.strictEqual(projector.pending, 0);

    const warnings = records.filter((record) => record.level === "warn");
    assert.strictEqual(warnings.length, 1);
    assert.strictEqual(warnings[0].metadata.reason, "unsupported");
  });
});

describe("AssetProjector — events absorbed during a write", () => {
  test("projects an update that arrives while a write is in flight", async() => {
    await using harness = await syncHarness({
      source: new SlowAssetSource()
    });
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("0"),
      actor: kActor
    })).unwrap();
    for (let index = 1; index <= 5; index++) {
      await harness.writer.update({
        assetId: created.assetId,
        data: bytes(String(index)),
        actor: kActor
      });
    }
    await harness.projector.flush();

    assert.strictEqual(text(await harness.source.read("a.png")), "5");
    assert.strictEqual(harness.projector.pending, 0);
  });

  test("projects a deletion that arrives while a write is in flight", async() => {
    await using harness = await syncHarness({
      source: new SlowAssetSource()
    });
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("0"),
      actor: kActor
    })).unwrap();
    await harness.writer.remove({
      assetId: created.assetId,
      actor: kActor
    });
    await harness.projector.flush();

    assert.strictEqual(await harness.source.exists("a.png"), false);
  });
});
