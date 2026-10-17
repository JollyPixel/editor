// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  CatalogProjection,
  createAssetBackend,
  encodeContent,
  type AssetEventDataMap
} from "#src/index.ts";
import {
  linkContent,
  linkHandler,
  linkReference
} from "../helpers/kinds.ts";
import { bytes } from "../helpers/bytes.ts";
import { sha256Hex } from "../helpers/hash.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

function legacyCreated(
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>,
  assetId: string,
  path: string,
  data: Uint8Array
): void {
  eventStore.writer.append({
    assetType: "link",
    assetId,
    eventType: ASSET_CREATED,
    eventData: {
      path,
      kind: "link",
      hash: sha256Hex(data),
      size: data.byteLength,
      content: encodeContent(data)
    },
    actor: kActor
  }).unwrap();
}

function unindexedIds(
  projection: CatalogProjection
): string[] {
  return Array.from(
    projection.unindexed(),
    (record) => record.id.value
  );
}

describe("createAssetBackend — dependency backfill", () => {
  test("rewrites assets whose newest write has no edges, once", async() => {
    const source = new MemoryAssetSource();
    const eventStore = EventStore.persistence.memory<AssetEventDataMap>();
    const data = linkContent("tex");
    await source.write("old.link", data);
    legacyCreated(eventStore, "old", "old.link", data);

    {
      await using backend = await createAssetBackend({
        source,
        eventStore,
        handlers: [linkHandler()],
        watch: false
      });

      assert.deepEqual(backend.catalog.dependencies.listDependencies("old"), [
        linkReference("tex")
      ]);
      assert.deepEqual(unindexedIds(backend.catalog), []);
    }

    const count = eventStore.reader.list("old").length;
    {
      await using backend = await createAssetBackend({
        source,
        eventStore,
        handlers: [linkHandler()],
        watch: false
      });

      assert.deepEqual(backend.catalog.dependencies.listDependents("tex"), ["old"]);
    }
    assert.strictEqual(eventStore.reader.list("old").length, count);
    eventStore.close();
  });

  test("leaves kinds without edges alone", async() => {
    const source = new MemoryAssetSource();
    const eventStore = EventStore.persistence.memory<AssetEventDataMap>();
    const data = bytes("png");
    await source.write("a.png", data);
    eventStore.writer.append({
      assetType: "binary",
      assetId: "png",
      eventType: ASSET_CREATED,
      eventData: {
        path: "a.png",
        kind: "binary",
        hash: sha256Hex(data),
        size: data.byteLength,
        content: encodeContent(data)
      },
      actor: kActor
    }).unwrap();

    await using backend = await createAssetBackend({
      source,
      eventStore,
      watch: false
    });

    assert.strictEqual(eventStore.reader.list("png").length, 1);
    assert.deepEqual(unindexedIds(backend.catalog), ["png"]);
  });
});
