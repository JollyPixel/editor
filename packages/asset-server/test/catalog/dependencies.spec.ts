// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  ASSET_UPDATED,
  CatalogProjection,
  encodeContent,
  type AssetEventDataMap,
  type CatalogChange
} from "#src/index.ts";
import { syncHarness, type SyncHarness } from "../helpers/backend.ts";
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
    const projection = new CatalogProjection({ projector: harness.projector });
    projection.load();
    projection.start();
    const changes: CatalogChange[] = [];
    projection.on("changed", (change) => changes.push(change));

    const map = await createLink(harness, "map.link", "tex");
    assert.deepEqual(projection.dependencies.listDependencies(map), [linkReference("tex")]);
    assert.deepEqual(projection.dependencies.listDependents("tex"), [map]);
    assert.deepEqual(
      projection.listDependents("tex").map((record) => record.id.value),
      [map]
    );
    assert.deepEqual(changes.at(-1)?.dependencies, [linkReference("tex")]);

    await harness.writer.update({
      assetId: map,
      data: linkContent("other"),
      actor: kActor
    });
    assert.deepEqual(projection.dependencies.listDependents("tex"), []);
    assert.deepEqual(projection.dependencies.listDependents("other"), [map]);

    await harness.writer.rename({
      assetId: map,
      to: "renamed.link",
      actor: kActor
    });
    assert.deepEqual(projection.dependencies.listDependencies(map), [linkReference("other")]);
    assert.deepEqual(changes.at(-1)?.dependencies, [linkReference("other")]);

    await harness.writer.remove({
      assetId: map,
      actor: kActor
    });
    assert.deepEqual(projection.dependencies.listDependencies(map), []);
    assert.deepEqual(projection.dependencies.listDependents("other"), []);
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

    const projection = new CatalogProjection({ projector: harness.projector });
    projection.load();

    assert.deepEqual(projection.dependencies.listDependents(texture), [map]);
    assert.deepEqual(projection.dependencies.listDependencies(map), [linkReference(texture)]);
  });

  test("events without edges are reported as unindexed", async() => {
    const eventStore = EventStore.persistence.memory<AssetEventDataMap>();
    legacyCreated(eventStore, "old", "old.link", linkContent("a"));

    {
      await using harness = await syncHarness({ eventStore });
      const projection = new CatalogProjection({ projector: harness.projector });
      projection.load();

      assert.deepEqual(unindexedIds(projection), ["old"]);
      assert.deepEqual(projection.dependencies.toJSON(), {});
    }
    eventStore.close();
  });
});
