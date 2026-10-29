// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { EventVersionConflictError } from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  ASSET_CHECKPOINT_EVENT_TYPES,
  UnknownAssetError,
  UnknownTagError,
  UnrestorableTagError
} from "#src/index.ts";
import {
  tagHarness,
  TAG_ACTOR,
  type TagHarness
} from "../../helpers/tags/tagHarness.ts";
import {
  linkContent,
  linkHandler
} from "../../helpers/kinds.ts";
import { bytes } from "../../helpers/bytes.ts";
import { sha256Hex } from "../../helpers/hash.ts";

async function tag(
  harness: TagHarness,
  name: string
): Promise<void> {
  (await harness.tags.create({
    assetId: harness.assetId,
    name,
    actor: TAG_ACTOR
  })).unwrap();
}

function restore(
  harness: TagHarness,
  name: string
) {
  return harness.tags.restore({
    assetId: harness.assetId,
    name,
    actor: TAG_ACTOR
  });
}

describe("AssetTags — restore", () => {
  test("brings the tagged content back to the live state and the file", async() => {
    await using harness = await tagHarness();
    await harness.increment();
    await harness.increment();
    await tag(harness, "v1");
    for (let index = 0; index < 3; index++) {
      await harness.increment();
    }

    const report = (await restore(harness, "v1")).unwrap();

    assert.strictEqual(report.restored, true);
    assert.deepEqual(report.missing, []);
    assert.strictEqual(report.restorePoint?.name, "restore/8");
    assert.strictEqual(report.restorePoint?.hash, sha256Hex(bytes("5")));
    assert.strictEqual(report.restorePoint?.message, "Before restoring \"v1\"");
    assert.deepEqual(report.restorePoint?.actor, {
      type: "system",
      source: "restore"
    });
    assert.strictEqual(harness.liveValue(), 2);
    assert.strictEqual(await harness.read("a.counter"), "2");

    const last = (await harness.sync.eventStore.reader.list(harness.assetId)).at(-1)!;
    assert.deepEqual(last.actor, TAG_ACTOR);
    assert.deepEqual(
      (last.eventData as { restoredFrom?: unknown; }).restoredFrom,
      { name: "v1", eventVersion: 4 }
    );
  });

  test("restoring the restore point undoes the restore", async() => {
    await using harness = await tagHarness();
    await tag(harness, "v1");
    await harness.increment();
    const { restorePoint } = (await restore(harness, "v1")).unwrap();

    (await restore(harness, restorePoint!.name)).unwrap();

    assert.strictEqual(harness.liveValue(), 1);
    assert.strictEqual(await harness.read("a.counter"), "1");
  });

  test("adds no restore point when a tag already holds the current content", async() => {
    await using harness = await tagHarness();
    await harness.increment();
    await tag(harness, "v1");
    await harness.increment();
    await tag(harness, "v2");

    const report = (await restore(harness, "v1")).unwrap();

    assert.strictEqual(report.restorePoint, undefined);
    assert.deepEqual(
      (await harness.tags.list(harness.assetId)).map(({ name }) => name),
      ["v1", "v2"]
    );
  });

  test("does nothing when the tagged content is the current content", async() => {
    await using harness = await tagHarness();
    await harness.increment();
    await tag(harness, "v1");
    const before = (await harness.sync.eventStore.reader.list(harness.assetId)).length;

    const report = (await restore(harness, "v1")).unwrap();

    assert.deepEqual(report, {
      restored: false,
      missing: []
    });
    assert.strictEqual(
      (await harness.sync.eventStore.reader.list(harness.assetId)).length,
      before
    );
    assert.strictEqual((await harness.tags.list(harness.assetId)).length, 1);
  });

  test("still works once compaction removed the events around the tag", async() => {
    await using harness = await tagHarness({ compact: true });
    await harness.increment();
    await tag(harness, "v1");
    for (let index = 0; index < 3; index++) {
      await harness.increment();
      await harness.sync.scheduler.flush(harness.assetId);
    }
    await harness.sync.eventStore.compact({
      checkpointEventTypes: ASSET_CHECKPOINT_EVENT_TYPES
    });

    (await restore(harness, "v1")).unwrap();

    assert.strictEqual(harness.liveValue(), 1);
    assert.strictEqual(await harness.read("a.counter"), "1");
  });

  test("keeps the current path of a renamed asset", async() => {
    await using harness = await tagHarness();
    await tag(harness, "v1");
    (await harness.sync.writer.rename({
      assetId: harness.assetId,
      to: "b.counter",
      actor: TAG_ACTOR
    })).unwrap();
    await harness.increment();

    (await restore(harness, "v1")).unwrap();

    assert.strictEqual(await harness.read("b.counter"), "0");
    assert.strictEqual(await harness.read("a.counter"), null);
  });

  test("reports the tagged dependencies that no longer exist", async() => {
    await using harness = await tagHarness({ handlers: [linkHandler()] });
    const target = (await harness.sync.writer.create({
      path: "target.bin",
      data: bytes("t"),
      actor: TAG_ACTOR
    })).unwrap();
    const link = (await harness.sync.writer.create({
      path: "a.link",
      data: linkContent(target.assetId),
      actor: TAG_ACTOR
    })).unwrap();
    (await harness.tags.create({
      assetId: link.assetId,
      name: "v1",
      actor: TAG_ACTOR
    })).unwrap();
    (await harness.sync.writer.update({
      assetId: link.assetId,
      data: linkContent(),
      actor: TAG_ACTOR
    })).unwrap();
    (await harness.sync.writer.remove({
      assetId: target.assetId,
      actor: TAG_ACTOR
    })).unwrap();

    const report = (await harness.tags.restore({
      assetId: link.assetId,
      name: "v1",
      actor: TAG_ACTOR
    })).unwrap();

    assert.deepEqual(report.missing, [
      { id: target.assetId, kind: "binary" }
    ]);
  });

  test("an edit landing during the restore fails it with a version conflict", async() => {
    let editing = false;
    await using harness = await tagHarness({
      writer: (sync) => {
        return {
          update: async(input) => {
            if (editing) {
              await harness.increment();
            }

            return sync.writer.update(input);
          }
        };
      }
    });
    await tag(harness, "v1");
    await harness.increment();
    editing = true;

    const restored = await restore(harness, "v1");

    assert.ok(!restored.ok);
    assert.ok(restored.val instanceof EventVersionConflictError);
    assert.strictEqual(harness.liveValue(), 2);
  });

  test("a deleted asset is not restored and keeps its tags", async() => {
    await using harness = await tagHarness();
    await tag(harness, "v1");
    (await harness.sync.writer.remove({
      assetId: harness.assetId,
      actor: TAG_ACTOR
    })).unwrap();

    const restored = await restore(harness, "v1");

    assert.ok(!restored.ok);
    assert.ok(restored.val instanceof UnknownAssetError);
    assert.deepEqual(
      (await harness.tags.list(harness.assetId)).map(({ name }) => name),
      ["v1"]
    );
  });

  test("an unknown tag is refused", async() => {
    await using harness = await tagHarness();

    const restored = await restore(harness, "v1");

    assert.ok(!restored.ok);
    assert.ok(restored.val instanceof UnknownTagError);
  });

  test("a tag on an event without content cannot be restored", async() => {
    await using harness = await tagHarness();
    const renamed = (await harness.sync.writer.rename({
      assetId: harness.assetId,
      to: "b.counter",
      actor: TAG_ACTOR
    })).unwrap();
    await harness.increment();
    (await harness.sync.eventStore.tags.create({
      assetId: harness.assetId,
      name: "renamed",
      eventVersion: renamed.eventVersion,
      actor: TAG_ACTOR
    })).unwrap();

    const restored = await restore(harness, "renamed");

    assert.ok(!restored.ok);
    assert.ok(restored.val instanceof UnrestorableTagError);
  });
});
