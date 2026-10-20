// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { EventTagConflictError } from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  ASSET_RENAMED,
  InvalidTagMessageError,
  TAG_MESSAGE_MAX_LENGTH,
  UnknownAssetError
} from "#src/index.ts";
import {
  tagHarness,
  TAG_ACTOR
} from "../../helpers/tags/tagHarness.ts";
import { bytes } from "../../helpers/bytes.ts";
import { sha256Hex } from "../../helpers/hash.ts";

describe("AssetTags — create", () => {
  test("a tag captures the live state once it is flushed", async() => {
    await using harness = await tagHarness();
    harness.increment();
    harness.increment();

    const tag = (await harness.tags.create({
      assetId: harness.assetId,
      name: "v1",
      message: "First pass",
      actor: TAG_ACTOR
    })).unwrap();

    assert.deepEqual(tag, {
      assetId: harness.assetId,
      name: "v1",
      message: "First pass",
      actor: TAG_ACTOR,
      createdAt: tag.createdAt,
      eventVersion: 4,
      path: "a.counter",
      hash: sha256Hex(bytes("2")),
      size: 1
    });
    assert.deepEqual(harness.tags.list(harness.assetId), [tag]);
  });

  test("a deleted asset cannot be tagged", async() => {
    await using harness = await tagHarness();
    (await harness.sync.writer.remove({
      assetId: harness.assetId,
      actor: TAG_ACTOR
    })).unwrap();

    const created = await harness.tags.create({
      assetId: harness.assetId,
      name: "v1",
      actor: TAG_ACTOR
    });

    assert.ok(!created.ok);
    assert.ok(created.val instanceof UnknownAssetError);
  });

  test("a name the asset already uses is refused", async() => {
    await using harness = await tagHarness();
    const input = {
      assetId: harness.assetId,
      name: "v1",
      actor: TAG_ACTOR
    };
    (await harness.tags.create(input)).unwrap();

    const created = await harness.tags.create(input);

    assert.ok(!created.ok);
    assert.ok(created.val instanceof EventTagConflictError);
  });

  test("a message over the limit is refused", async() => {
    await using harness = await tagHarness();

    const created = await harness.tags.create({
      assetId: harness.assetId,
      name: "v1",
      message: "a".repeat(TAG_MESSAGE_MAX_LENGTH + 1),
      actor: TAG_ACTOR
    });

    assert.ok(!created.ok);
    assert.ok(created.val instanceof InvalidTagMessageError);
    assert.deepEqual(harness.tags.list(harness.assetId), []);
  });
});

describe("AssetTags — list", () => {
  test("lists tags in creation order with the path each was taken at", async() => {
    await using harness = await tagHarness();
    (await harness.tags.create({
      assetId: harness.assetId,
      name: "v1",
      actor: TAG_ACTOR
    })).unwrap();
    (await harness.sync.writer.rename({
      assetId: harness.assetId,
      to: "b.counter",
      actor: TAG_ACTOR
    })).unwrap();
    harness.increment();
    (await harness.tags.create({
      assetId: harness.assetId,
      name: "v2",
      actor: TAG_ACTOR
    })).unwrap();

    assert.deepEqual(
      harness.tags.list(harness.assetId).map(({ name, path }) => {
        return { name, path };
      }),
      [
        { name: "v1", path: "a.counter" },
        { name: "v2", path: "b.counter" }
      ]
    );
  });

  test("skips a tag the event store holds on an event without content", async() => {
    await using harness = await tagHarness();
    const renamed = (await harness.sync.writer.rename({
      assetId: harness.assetId,
      to: "b.counter",
      actor: TAG_ACTOR
    })).unwrap();
    assert.strictEqual(renamed.eventType, ASSET_RENAMED);
    harness.sync.eventStore.tags.create({
      assetId: harness.assetId,
      name: "renamed",
      eventVersion: renamed.eventVersion,
      actor: TAG_ACTOR
    }).unwrap();

    assert.deepEqual(harness.tags.list(harness.assetId), []);
  });
});
