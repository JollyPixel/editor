// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  ASSET_UPDATED,
  CatalogProjection,
  createAssetBackend,
  encodeContent,
  type AssetEventDataMap,
  type CatalogChange
} from "#src/index.ts";
import {
  syncHarness,
  type SyncHarness
} from "../helpers/backend.ts";
import {
  LINK_TARGETS_SET,
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

function lastWrite(
  harness: SyncHarness,
  assetId: string
) {
  const writes = harness.eventStore.reader
    .list(assetId)
    .filter((event) => event.eventType === ASSET_CREATED ||
      event.eventType === ASSET_UPDATED);

  return writes.at(-1)?.eventData as { dependencies?: unknown; };
}

async function createLink(
  harness: SyncHarness,
  path: string,
  ...targets: string[]
): Promise<string> {
  const created = await harness.writer.create({
    path,
    data: linkContent(...targets),
    actor: kActor
  });

  return created.unwrap().assetId;
}

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

describe("dependency edges on lifecycle events", () => {
  test("create and update record the handler's edges", async() => {
    await using harness = await syncHarness({ handlers: [linkHandler()] });
    const assetId = await createLink(harness, "map.link", "a", "b");

    assert.deepEqual(lastWrite(harness, assetId).dependencies, [
      linkReference("a"),
      linkReference("b")
    ]);

    await harness.writer.update({
      assetId,
      data: linkContent("c"),
      actor: kActor
    });
    assert.deepEqual(lastWrite(harness, assetId).dependencies, [
      linkReference("c")
    ]);
  });

  test("explicit edges win, deduplicated and without self references", async() => {
    await using harness = await syncHarness({ handlers: [linkHandler()] });
    const assetId = await createLink(harness, "map.link");

    await harness.writer.update({
      assetId,
      data: linkContent("ignored"),
      dependencies: [
        linkReference("x"),
        linkReference(assetId),
        linkReference("x")
      ],
      actor: kActor
    });

    assert.deepEqual(lastWrite(harness, assetId).dependencies, [
      linkReference("x")
    ]);
  });

  test("kinds without edges and unreadable content record none", async() => {
    await using harness = await syncHarness({ handlers: [linkHandler()] });
    const binary = (await harness.writer.create({
      path: "a.png",
      data: bytes("png"),
      actor: kActor
    })).unwrap();
    const broken = await createLink(harness, "broken.link", "!");

    const binaryWrite = harness.eventStore.reader
      .list(binary.assetId)[0].eventData as { dependencies: unknown; };
    assert.deepEqual(binaryWrite.dependencies, []);
    assert.deepEqual(lastWrite(harness, broken).dependencies, []);
  });

  test("reconcile records edges from disk content", async() => {
    await using harness = await syncHarness({ handlers: [linkHandler()] });
    await harness.source.write("outside.link", linkContent("a"));

    (await harness.reconciler.reconcile()).unwrap();
    const assetId = harness.identity.byPath("outside.link")!.id;
    assert.deepEqual(lastWrite(harness, assetId).dependencies, [
      linkReference("a")
    ]);

    await harness.source.write("outside.link", linkContent("b", "c"));
    (await harness.reconciler.reconcile()).unwrap();
    assert.deepEqual(lastWrite(harness, assetId).dependencies, [
      linkReference("b"),
      linkReference("c")
    ]);
  });

  test("snapshots record edges from the live state", async() => {
    await using harness = await syncHarness({ handlers: [linkHandler()] });
    const assetId = await createLink(harness, "map.link", "a");
    await harness.projector.flush();
    await harness.states.acquire(assetId, "link");

    harness.eventStore.writer.append({
      assetType: "link",
      assetId,
      eventType: LINK_TARGETS_SET,
      eventData: { action: "set", targets: ["b"] },
      actor: kActor
    }).unwrap();
    await harness.scheduler.flush(assetId);

    assert.deepEqual(lastWrite(harness, assetId).dependencies, [
      linkReference("b")
    ]);
  });
});

describe("CatalogProjection — dependency index", () => {
  test("follows create, update, rename and delete", async() => {
    await using harness = await syncHarness({ handlers: [linkHandler()] });
    const projection = new CatalogProjection({ eventStore: harness.eventStore });
    projection.load();
    projection.start();
    const changes: CatalogChange[] = [];
    projection.on("changed", (change) => changes.push(change));

    const map = await createLink(harness, "map.link", "tex");
    assert.deepEqual(projection.dependencies.dependenciesOf(map), [linkReference("tex")]);
    assert.deepEqual(projection.dependencies.dependentsOf("tex"), [map]);
    assert.deepEqual(
      projection.dependentsOf("tex").map((record) => record.id.value),
      [map]
    );
    assert.deepEqual(changes.at(-1)?.dependencies, [linkReference("tex")]);

    await harness.writer.update({
      assetId: map,
      data: linkContent("other"),
      actor: kActor
    });
    assert.deepEqual(projection.dependencies.dependentsOf("tex"), []);
    assert.deepEqual(projection.dependencies.dependentsOf("other"), [map]);

    await harness.writer.rename({
      assetId: map,
      to: "renamed.link",
      actor: kActor
    });
    assert.deepEqual(projection.dependencies.dependenciesOf(map), [linkReference("other")]);
    assert.deepEqual(changes.at(-1)?.dependencies, [linkReference("other")]);

    await harness.writer.remove({
      assetId: map,
      actor: kActor
    });
    assert.deepEqual(projection.dependencies.dependenciesOf(map), []);
    assert.deepEqual(projection.dependencies.dependentsOf("other"), []);
    assert.strictEqual(changes.at(-1)?.dependencies, undefined);
    assert.deepEqual(projection.dependencies.toJSON(), {});

    projection.close();
  });

  test("a deleted dependency keeps its dependents", async() => {
    await using harness = await syncHarness({ handlers: [linkHandler()] });
    const texture = await createLink(harness, "texture.link");
    const map = await createLink(harness, "map.link", texture);
    await harness.writer.remove({
      assetId: texture,
      actor: kActor
    });

    const projection = new CatalogProjection({ eventStore: harness.eventStore });
    projection.load();

    assert.deepEqual(projection.dependencies.dependentsOf(texture), [map]);
    assert.deepEqual(projection.dependencies.dependenciesOf(map), [linkReference(texture)]);
  });

  test("closureOf resolves transitive edges and survives cycles", async() => {
    await using harness = await syncHarness({ handlers: [linkHandler()] });
    const projection = new CatalogProjection({ eventStore: harness.eventStore });
    projection.load();
    projection.start();

    const a = await createLink(harness, "a.link");
    const b = await createLink(harness, "b.link", a);
    await harness.writer.update({
      assetId: a,
      data: linkContent(b),
      actor: kActor
    });

    assert.deepEqual(projection.dependencies.closureOf(a), [linkReference(b)]);
    assert.deepEqual(projection.dependencies.closureOf(b), [linkReference(a)]);
    projection.close();
  });

  test("events without edges are reported as unindexed", () => {
    const eventStore = EventStore.persistence.memory<AssetEventDataMap>();
    legacyCreated(eventStore, "old", "old.link", linkContent("a"));

    const projection = new CatalogProjection({ eventStore });
    projection.load();

    assert.deepEqual(unindexedIds(projection), ["old"]);
    assert.deepEqual(projection.dependencies.toJSON(), {});
    eventStore.close();
  });
});

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

      assert.deepEqual(backend.catalog.dependencies.dependenciesOf("old"), [
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

      assert.deepEqual(backend.catalog.dependencies.dependentsOf("tex"), ["old"]);
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
